"""
测试可复现性和形式化验证
"""

import pytest
import tempfile
from pathlib import Path
from petri.utils.reproducibility import (
    ReproducibilityManager,
    WeightCalibrator,
    DecisionRecord,
)


def test_seed_setting():
    """测试随机种子设置"""
    manager = ReproducibilityManager(random_seed=42)
    assert manager.random_seed == 42


def test_decision_recording():
    """测试决策记录"""
    manager = ReproducibilityManager(enable_logging=False)
    
    manager.record_decision(
        decision_type="strategy_selection",
        input_data={"current_strategy": "direct"},
        output_data={"next_strategy": "reframing"},
        reasoning="Target refused, switching strategy",
        confidence=0.9,
    )
    
    assert len(manager.decision_chain) == 1
    assert manager.decision_chain[0].decision_type == "strategy_selection"
    assert manager.decision_chain[0].confidence == 0.9


def test_decision_chain_save_load():
    """测试决策链保存和加载"""
    with tempfile.TemporaryDirectory() as tmpdir:
        manager = ReproducibilityManager(
            random_seed=42,
            enable_logging=True,
            log_dir=tmpdir,
        )
        
        # 记录几个决策
        for i in range(3):
            manager.record_decision(
                decision_type=f"test_{i}",
                input_data={"index": i},
                output_data={"result": i * 2},
                reasoning=f"Test decision {i}",
                confidence=0.8,
            )
        
        # 保存
        filepath = manager.save_decision_chain()
        assert filepath.exists()
        
        # 加载
        loaded_chain = manager.load_decision_chain(filepath)
        assert len(loaded_chain) == 3
        assert loaded_chain[0].decision_type == "test_0"


def test_reproducibility_verification():
    """测试可复现性验证"""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        
        # 创建两个相同的决策链
        manager1 = ReproducibilityManager(enable_logging=False)
        manager2 = ReproducibilityManager(enable_logging=False)
        
        for i in range(5):
            for manager in [manager1, manager2]:
                manager.record_decision(
                    decision_type="test",
                    input_data={"i": i},
                    output_data={"result": i},
                    reasoning="test",
                    confidence=1.0,
                )
        
        # 保存
        manager1.log_dir = tmpdir
        manager2.log_dir = tmpdir
        
        path1 = manager1.save_decision_chain("chain1.json")
        path2 = manager2.save_decision_chain("chain2.json")
        
        # 验证
        result = manager1.verify_reproducibility(path1, path2)
        assert result["is_reproducible"]
        assert result["match_rate"] == 1.0


def test_reproducibility_verification_mismatch():
    """测试可复现性验证 - 不匹配情况"""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        
        manager1 = ReproducibilityManager(enable_logging=False)
        manager2 = ReproducibilityManager(enable_logging=False)
        
        # 创建不同的决策链
        manager1.record_decision(
            decision_type="test",
            input_data={},
            output_data={"result": 1},
            reasoning="test",
            confidence=1.0,
        )
        
        manager2.record_decision(
            decision_type="test",
            input_data={},
            output_data={"result": 2},  # 不同的输出
            reasoning="test",
            confidence=1.0,
        )
        
        manager1.log_dir = tmpdir
        manager2.log_dir = tmpdir
        
        path1 = manager1.save_decision_chain("chain1.json")
        path2 = manager2.save_decision_chain("chain2.json")
        
        result = manager1.verify_reproducibility(path1, path2)
        assert not result["is_reproducible"]
        assert len(result["mismatches"]) > 0


def test_config_hash():
    """测试配置哈希"""
    manager = ReproducibilityManager(enable_logging=False)
    
    config1 = {"a": 1, "b": 2}
    config2 = {"b": 2, "a": 1}  # 相同内容，不同顺序
    config3 = {"a": 1, "b": 3}  # 不同内容
    
    hash1 = manager.create_config_hash(config1)
    hash2 = manager.create_config_hash(config2)
    hash3 = manager.create_config_hash(config3)
    
    assert hash1 == hash2  # 顺序不影响哈希
    assert hash1 != hash3  # 内容不同，哈希不同


def test_config_save():
    """测试配置保存"""
    with tempfile.TemporaryDirectory() as tmpdir:
        manager = ReproducibilityManager(
            random_seed=42,
            enable_logging=True,
            log_dir=tmpdir,
        )
        
        config = {
            "model_temperature": 0.0,
            "max_turns": 20,
            "enable_deterministic": True,
        }
        
        filepath = manager.save_config(config)
        assert filepath.exists()
        assert manager.config is not None
        assert manager.config.random_seed == 42


def test_weight_validation():
    """测试权重验证"""
    calibrator = WeightCalibrator()
    
    # 有效权重
    valid_weights = {
        "a": 0.3,
        "b": 0.3,
        "c": 0.4,
    }
    is_valid, errors = calibrator.validate_weights(valid_weights)
    assert is_valid
    assert len(errors) == 0
    
    # 无效权重 - 总和不为 1
    invalid_weights = {
        "a": 0.5,
        "b": 0.4,
    }
    is_valid, errors = calibrator.validate_weights(invalid_weights)
    assert not is_valid
    assert len(errors) > 0


def test_weight_validation_negative():
    """测试负权重验证"""
    calibrator = WeightCalibrator()
    
    negative_weights = {
        "a": 0.6,
        "b": -0.1,
        "c": 0.5,
    }
    is_valid, errors = calibrator.validate_weights(negative_weights)
    assert not is_valid
    assert any("负权重" in error for error in errors)


def test_weight_comparison():
    """测试权重比较"""
    calibrator = WeightCalibrator()

    weights1 = {"a": 0.3, "b": 0.7}
    weights2 = {"a": 0.4, "b": 0.6}

    comparison = calibrator.compare_weight_sets(weights1, weights2)

    assert "differences" in comparison
    assert abs(comparison["differences"]["a"]["difference"] - 0.1) < 0.001
    assert abs(comparison["differences"]["b"]["difference"] - (-0.1)) < 0.001


def test_reproducibility_report():
    """测试可复现性报告"""
    manager = ReproducibilityManager(random_seed=42, enable_logging=False)
    
    # 记录一些决策
    manager.record_decision(
        decision_type="test1",
        input_data={},
        output_data={},
        reasoning="test",
        confidence=0.9,
    )
    manager.record_decision(
        decision_type="test2",
        input_data={},
        output_data={},
        reasoning="test",
        confidence=0.8,
    )
    
    report = manager.get_reproducibility_report()

    assert report["random_seed"] == 42
    assert report["decision_count"] == 2
    assert abs(report["average_confidence"] - 0.85) < 0.001


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

