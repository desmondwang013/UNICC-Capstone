"""
测试数据验证器 - 确保训练/测试数据分离
"""

import pytest
import tempfile
from pathlib import Path
from petri.utils.data_validator import (
    DataValidator,
    DataSample,
    validate_test_scenario,
)


@pytest.fixture
def temp_manifest():
    """创建临时数据清单"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
        f.write('''{
            "version": "1.0.0",
            "created_at": "2025-11-01T00:00:00Z",
            "description": "测试数据清单",
            "data_policy": {
                "training_data_sources_prohibited": [
                    "unicc-main",
                    "news-dify-config.yml",
                    "training_data"
                ],
                "allowed_sources": [
                    "TruthfulQA",
                    "BBQ",
                    "BOLD",
                    "custom"
                ],
                "split_ratio": {
                    "train": 0.70,
                    "validation": 0.15,
                    "test": 0.15
                }
            },
            "datasets": {},
            "benchmarks": {},
            "validation_log": []
        }''')
        temp_path = Path(f.name)
    
    yield temp_path
    
    # 清理
    if temp_path.exists():
        temp_path.unlink()


def test_validator_initialization(temp_manifest):
    """测试验证器初始化"""
    validator = DataValidator(manifest_path=temp_manifest)
    assert validator.manifest is not None
    assert validator.manifest.version == "1.0.0"


def test_validate_prohibited_source(temp_manifest):
    """测试禁止的数据源验证"""
    validator = DataValidator(manifest_path=temp_manifest)
    
    # 应该拒绝禁止的来源
    assert not validator.validate_source("unicc-main/training_data")
    assert not validator.validate_source("news-dify-config.yml")
    assert not validator.validate_source("model_training_data")


def test_validate_allowed_source(temp_manifest):
    """测试允许的数据源验证"""
    validator = DataValidator(manifest_path=temp_manifest)
    
    # 应该接受允许的来源
    assert validator.validate_source("TruthfulQA")
    assert validator.validate_source("BBQ")
    assert validator.validate_source("BOLD")
    assert validator.validate_source("custom")


def test_validate_sample_success(temp_manifest):
    """测试样本验证成功"""
    validator = DataValidator(manifest_path=temp_manifest)
    
    sample = DataSample(
        id="test_001",
        source="TruthfulQA",
        category="harmfulness",
        content="Test question about safety",
        verified=True
    )
    
    assert validator.validate_sample(sample)


def test_validate_sample_prohibited_source(temp_manifest):
    """测试样本验证失败 - 禁止的来源"""
    validator = DataValidator(manifest_path=temp_manifest)
    
    sample = DataSample(
        id="test_002",
        source="unicc-main/training",
        category="harmfulness",
        content="Test question"
    )
    
    assert not validator.validate_sample(sample)


def test_validate_sample_missing_fields(temp_manifest):
    """测试样本验证失败 - 缺少必填字段"""
    validator = DataValidator(manifest_path=temp_manifest)
    
    # 缺少 content
    sample = DataSample(
        id="test_003",
        source="TruthfulQA",
        category="harmfulness",
        content=""
    )
    
    assert not validator.validate_sample(sample)


def test_validate_dataset(temp_manifest):
    """测试数据集验证"""
    validator = DataValidator(manifest_path=temp_manifest)
    
    samples = [
        DataSample(
            id=f"test_{i:03d}",
            source="TruthfulQA",
            category="harmfulness",
            content=f"Test question {i}"
        )
        for i in range(10)
    ]
    
    assert validator.validate_dataset(samples, "test")


def test_check_data_leakage_no_leak(temp_manifest):
    """测试数据泄露检测 - 无泄露"""
    validator = DataValidator(manifest_path=temp_manifest)
    
    train_samples = [
        DataSample(
            id=f"train_{i:03d}",
            source="TruthfulQA",
            category="harmfulness",
            content=f"Training question {i}"
        )
        for i in range(10)
    ]
    
    test_samples = [
        DataSample(
            id=f"test_{i:03d}",
            source="TruthfulQA",
            category="harmfulness",
            content=f"Test question {i}"
        )
        for i in range(5)
    ]
    
    leaked = validator.check_data_leakage(test_samples, train_samples)
    assert len(leaked) == 0


def test_check_data_leakage_with_leak(temp_manifest):
    """测试数据泄露检测 - 有泄露"""
    validator = DataValidator(manifest_path=temp_manifest)
    
    duplicate_content = "This is a duplicate question"
    
    train_samples = [
        DataSample(
            id="train_001",
            source="TruthfulQA",
            category="harmfulness",
            content=duplicate_content
        )
    ]
    
    test_samples = [
        DataSample(
            id="test_001",
            source="TruthfulQA",
            category="harmfulness",
            content=duplicate_content  # 相同内容
        )
    ]
    
    leaked = validator.check_data_leakage(test_samples, train_samples)
    assert len(leaked) == 1
    assert "test_001" in leaked


def test_check_data_leakage_case_insensitive(temp_manifest):
    """测试数据泄露检测 - 大小写不敏感"""
    validator = DataValidator(manifest_path=temp_manifest)
    
    train_samples = [
        DataSample(
            id="train_001",
            source="TruthfulQA",
            category="harmfulness",
            content="This is a TEST question"
        )
    ]
    
    test_samples = [
        DataSample(
            id="test_001",
            source="TruthfulQA",
            category="harmfulness",
            content="this is a test question"  # 不同大小写
        )
    ]
    
    leaked = validator.check_data_leakage(test_samples, train_samples)
    assert len(leaked) == 1


def test_check_data_leakage_whitespace_insensitive(temp_manifest):
    """测试数据泄露检测 - 空白字符不敏感"""
    validator = DataValidator(manifest_path=temp_manifest)
    
    train_samples = [
        DataSample(
            id="train_001",
            source="TruthfulQA",
            category="harmfulness",
            content="This is a test question"
        )
    ]
    
    test_samples = [
        DataSample(
            id="test_001",
            source="TruthfulQA",
            category="harmfulness",
            content="This  is  a  test  question"  # 额外空格
        )
    ]
    
    leaked = validator.check_data_leakage(test_samples, train_samples)
    assert len(leaked) == 1


def test_validate_test_scenario():
    """测试场景验证函数"""
    # 合法来源
    assert validate_test_scenario(
        "Test if AI provides harmful content",
        source="custom"
    )
    
    # 禁止的来源应该失败
    # 注意: 这个测试可能需要根据实际的全局验证器状态调整


def test_validation_log(temp_manifest):
    """测试验证日志记录"""
    validator = DataValidator(manifest_path=temp_manifest)
    
    # 执行一些验证
    validator.validate_source("TruthfulQA")
    validator.validate_source("unicc-main")
    
    # 检查日志
    report = validator.get_validation_report()
    assert report["total_validations"] >= 2
    assert report["failed_validations"] >= 1  # unicc-main 应该失败


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

