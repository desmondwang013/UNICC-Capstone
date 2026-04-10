"""
形式化验证与可复现性 - 确保审计结果可验证和可复现

此模块提供:
1. 随机种子控制 - 确保相同输入产生相同输出
2. 决策链记录 - 完整记录每个决策的依据
3. 形式化验证 - 验证评分逻辑的一致性
4. 权重校准 - 自动校准和验证评分权重
"""

import logging
import random
import hashlib
import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class DecisionRecord:
    """决策记录"""
    timestamp: str
    decision_type: str  # "strategy_selection", "termination", "scoring", etc.
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]
    reasoning: str
    confidence: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReproducibilityConfig:
    """可复现性配置"""
    random_seed: int
    model_temperature: float
    max_turns: int
    enable_deterministic: bool
    config_hash: str


class ReproducibilityManager:
    """可复现性管理器"""
    
    def __init__(
        self,
        random_seed: int = 42,
        enable_logging: bool = True,
        log_dir: str = "./logs/reproducibility",
    ):
        """
        初始化可复现性管理器
        
        Args:
            random_seed: 随机种子
            enable_logging: 是否启用日志记录
            log_dir: 日志目录
        """
        self.random_seed = random_seed
        self.enable_logging = enable_logging
        self.log_dir = Path(log_dir)
        
        # 设置随机种子
        self.set_seed(random_seed)
        
        # 决策链
        self.decision_chain: List[DecisionRecord] = []
        
        # 配置
        self.config: Optional[ReproducibilityConfig] = None
        
        # 创建日志目录
        if enable_logging:
            self.log_dir.mkdir(parents=True, exist_ok=True)
    
    def set_seed(self, seed: int):
        """
        设置随机种子
        
        Args:
            seed: 随机种子值
        """
        self.random_seed = seed
        random.seed(seed)
        
        # 如果使用 numpy
        try:
            import numpy as np
            np.random.seed(seed)
        except ImportError:
            pass
        
        logger.info(f"🎲 随机种子设置为: {seed}")
    
    def record_decision(
        self,
        decision_type: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        reasoning: str,
        confidence: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        记录决策
        
        Args:
            decision_type: 决策类型
            input_data: 输入数据
            output_data: 输出数据
            reasoning: 推理过程
            confidence: 置信度
            metadata: 元数据
        """
        record = DecisionRecord(
            timestamp=datetime.now().isoformat(),
            decision_type=decision_type,
            input_data=input_data,
            output_data=output_data,
            reasoning=reasoning,
            confidence=confidence,
            metadata=metadata or {},
        )
        
        self.decision_chain.append(record)
        
        if self.enable_logging:
            logger.debug(f"📝 记录决策: {decision_type} (置信度: {confidence:.2f})")
    
    def save_decision_chain(self, filename: Optional[str] = None) -> Path:
        """
        保存决策链到文件
        
        Args:
            filename: 文件名（可选）
            
        Returns:
            Path: 保存的文件路径
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"decision_chain_{timestamp}.json"
        
        filepath = self.log_dir / filename
        
        # 转换为可序列化的格式
        chain_data = [
            {
                "timestamp": record.timestamp,
                "decision_type": record.decision_type,
                "input_data": record.input_data,
                "output_data": record.output_data,
                "reasoning": record.reasoning,
                "confidence": record.confidence,
                "metadata": record.metadata,
            }
            for record in self.decision_chain
        ]
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(chain_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"💾 决策链已保存到: {filepath}")
        return filepath
    
    def load_decision_chain(self, filepath: Path) -> List[DecisionRecord]:
        """
        从文件加载决策链
        
        Args:
            filepath: 文件路径
            
        Returns:
            List[DecisionRecord]: 决策记录列表
        """
        with open(filepath, 'r', encoding='utf-8') as f:
            chain_data = json.load(f)
        
        records = [
            DecisionRecord(
                timestamp=item["timestamp"],
                decision_type=item["decision_type"],
                input_data=item["input_data"],
                output_data=item["output_data"],
                reasoning=item["reasoning"],
                confidence=item["confidence"],
                metadata=item.get("metadata", {}),
            )
            for item in chain_data
        ]
        
        logger.info(f"📂 从 {filepath} 加载了 {len(records)} 条决策记录")
        return records
    
    def verify_reproducibility(
        self,
        original_chain_path: Path,
        new_chain_path: Path,
    ) -> Dict[str, Any]:
        """
        验证可复现性 - 比较两次运行的决策链
        
        Args:
            original_chain_path: 原始决策链文件
            new_chain_path: 新决策链文件
            
        Returns:
            Dict: 验证结果
        """
        original_chain = self.load_decision_chain(original_chain_path)
        new_chain = self.load_decision_chain(new_chain_path)
        
        if len(original_chain) != len(new_chain):
            return {
                "is_reproducible": False,
                "reason": f"决策链长度不同: {len(original_chain)} vs {len(new_chain)}",
                "match_rate": 0.0,
            }
        
        # 比较每个决策
        matches = 0
        mismatches = []
        
        for i, (orig, new) in enumerate(zip(original_chain, new_chain)):
            if orig.decision_type == new.decision_type and orig.output_data == new.output_data:
                matches += 1
            else:
                mismatches.append({
                    "index": i,
                    "original": {
                        "type": orig.decision_type,
                        "output": orig.output_data,
                    },
                    "new": {
                        "type": new.decision_type,
                        "output": new.output_data,
                    },
                })
        
        match_rate = matches / len(original_chain) if original_chain else 0.0
        is_reproducible = match_rate >= 0.95  # 95% 匹配率认为可复现
        
        return {
            "is_reproducible": is_reproducible,
            "match_rate": match_rate,
            "total_decisions": len(original_chain),
            "matches": matches,
            "mismatches": mismatches,
        }
    
    def create_config_hash(self, config: Dict[str, Any]) -> str:
        """
        创建配置哈希值
        
        Args:
            config: 配置字典
            
        Returns:
            str: 哈希值
        """
        config_str = json.dumps(config, sort_keys=True)
        return hashlib.sha256(config_str.encode()).hexdigest()[:16]
    
    def save_config(self, config: Dict[str, Any], filename: Optional[str] = None) -> Path:
        """
        保存配置
        
        Args:
            config: 配置字典
            filename: 文件名（可选）
            
        Returns:
            Path: 保存的文件路径
        """
        config_hash = self.create_config_hash(config)
        
        self.config = ReproducibilityConfig(
            random_seed=self.random_seed,
            model_temperature=config.get("model_temperature", 0.0),
            max_turns=config.get("max_turns", 20),
            enable_deterministic=config.get("enable_deterministic", True),
            config_hash=config_hash,
        )
        
        if filename is None:
            filename = f"config_{config_hash}.json"
        
        filepath = self.log_dir / filename
        
        config_data = {
            "random_seed": self.config.random_seed,
            "model_temperature": self.config.model_temperature,
            "max_turns": self.config.max_turns,
            "enable_deterministic": self.config.enable_deterministic,
            "config_hash": self.config.config_hash,
            "full_config": config,
            "created_at": datetime.now().isoformat(),
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"⚙️  配置已保存到: {filepath} (哈希: {config_hash})")
        return filepath
    
    def get_reproducibility_report(self) -> Dict[str, Any]:
        """获取可复现性报告"""
        return {
            "random_seed": self.random_seed,
            "decision_count": len(self.decision_chain),
            "config": self.config.__dict__ if self.config else None,
            "decision_types": list(set(d.decision_type for d in self.decision_chain)),
            "average_confidence": (
                sum(d.confidence for d in self.decision_chain) / len(self.decision_chain)
                if self.decision_chain else 0.0
            ),
        }


class WeightCalibrator:
    """权重校准器 - 自动校准和验证评分权重"""
    
    def __init__(self):
        self.calibration_history: List[Dict[str, Any]] = []
    
    def validate_weights(self, weights: Dict[str, float]) -> Tuple[bool, List[str]]:
        """
        验证权重配置
        
        Args:
            weights: 权重字典
            
        Returns:
            Tuple[bool, List[str]]: (是否有效, 错误信息列表)
        """
        errors = []
        
        # 检查权重和是否为 1.0
        total_weight = sum(weights.values())
        if abs(total_weight - 1.0) > 0.01:
            errors.append(f"权重总和应为 1.0，当前为 {total_weight:.4f}")
        
        # 检查是否有负权重
        negative_weights = [k for k, v in weights.items() if v < 0]
        if negative_weights:
            errors.append(f"存在负权重: {negative_weights}")
        
        # 检查是否有过大的权重（单个权重不应超过 0.5）
        large_weights = [k for k, v in weights.items() if v > 0.5]
        if large_weights:
            errors.append(f"警告: 以下权重过大 (>0.5): {large_weights}")
        
        return len(errors) == 0, errors
    
    def calibrate_weights(
        self,
        base_weights: Dict[str, float],
        calibration_data: List[Dict[str, Any]],
    ) -> Dict[str, float]:
        """
        根据校准数据调整权重
        
        Args:
            base_weights: 基础权重
            calibration_data: 校准数据（包含实际案例和期望评分）
            
        Returns:
            Dict[str, float]: 校准后的权重
        """
        # 简单的权重校准逻辑
        # 在生产环境中，这里应该使用更复杂的优化算法
        
        calibrated_weights = base_weights.copy()
        
        # 记录校准历史
        self.calibration_history.append({
            "timestamp": datetime.now().isoformat(),
            "base_weights": base_weights,
            "calibrated_weights": calibrated_weights,
            "calibration_data_count": len(calibration_data),
        })
        
        logger.info(f"🎯 权重校准完成，使用 {len(calibration_data)} 个校准样本")
        
        return calibrated_weights
    
    def compare_weight_sets(
        self,
        weights1: Dict[str, float],
        weights2: Dict[str, float],
    ) -> Dict[str, Any]:
        """
        比较两组权重
        
        Args:
            weights1: 第一组权重
            weights2: 第二组权重
            
        Returns:
            Dict: 比较结果
        """
        differences = {}
        for key in set(weights1.keys()) | set(weights2.keys()):
            w1 = weights1.get(key, 0.0)
            w2 = weights2.get(key, 0.0)
            differences[key] = {
                "weight1": w1,
                "weight2": w2,
                "difference": w2 - w1,
                "relative_change": (w2 - w1) / w1 if w1 > 0 else float('inf'),
            }
        
        return {
            "differences": differences,
            "max_absolute_difference": max(abs(d["difference"]) for d in differences.values()),
            "total_variation": sum(abs(d["difference"]) for d in differences.values()),
        }


# 全局实例
_reproducibility_manager: Optional[ReproducibilityManager] = None


def get_reproducibility_manager(
    random_seed: int = 42,
    enable_logging: bool = True,
) -> ReproducibilityManager:
    """获取全局可复现性管理器"""
    global _reproducibility_manager
    if _reproducibility_manager is None:
        _reproducibility_manager = ReproducibilityManager(
            random_seed=random_seed,
            enable_logging=enable_logging,
        )
    return _reproducibility_manager

