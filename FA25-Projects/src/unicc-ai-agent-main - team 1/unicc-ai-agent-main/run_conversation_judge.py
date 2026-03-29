"""
直接评判对话记录的脚本 - 不生成新对话，只评判已有对话
"""
import json
import os
import sys
from pathlib import Path
from datetime import datetime

# 路径配置（必须在导入 petri 之前）
PROJECT_PATH = Path(__file__).parent
INPUT_JSON_PATH = PROJECT_PATH / "input_temp.json"
OUTPUT_DIR = PROJECT_PATH / "outputs" / "conversation_judge"
CONFIG_FILE = PROJECT_PATH / "petri_config.json"

# 确保可以找到 src 里的 petri
sys.path.insert(0, str(PROJECT_PATH / "src"))

# 现在可以导入其他模块
from dotenv import load_dotenv
from inspect_ai import eval, Task
from inspect_ai.dataset import Sample
from inspect_ai.model import ChatMessageUser, ChatMessageAssistant, ChatMessageSystem
from inspect_ai.solver import TaskState, solver, Solver, Generate
from petri.scorers.compliance_judge import compliance_judge

# 加载环境变量
load_dotenv()

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def load_config():
    """加载配置"""
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def parse_conversation(conv_data):
    """
    解析对话数据为 ChatMessage 列表
    
    支持格式:
    1. {"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
    2. {"conversation": [{"role": "user", "content": "..."}, ...]}
    3. [{"role": "user", "content": "..."}, ...]
    """
    messages = []
    
    # 提取消息列表
    if isinstance(conv_data, dict):
        msg_list = conv_data.get("messages") or conv_data.get("conversation") or conv_data.get("history")
        if not msg_list:
            raise ValueError("对话数据必须包含 'messages', 'conversation', 或 'history' 字段")
    elif isinstance(conv_data, list):
        msg_list = conv_data
    else:
        raise ValueError("对话数据格式不正确")
    
    # 转换为 ChatMessage
    for msg in msg_list:
        role = msg.get("role", "").lower()
        content = msg.get("content", "")
        
        if not content:
            continue
            
        if role == "system":
            messages.append(ChatMessageSystem(content=content))
        elif role == "user":
            messages.append(ChatMessageUser(content=content))
        elif role == "assistant":
            messages.append(ChatMessageAssistant(content=content))
        else:
            # 默认当作 user 消息
            messages.append(ChatMessageUser(content=content))
    
    return messages


@solver
def conversation_loader(conversations_data: list) -> Solver:
    """
    加载已有对话到 TaskState，不生成新对话
    """
    async def solve(state: TaskState, generate: Generate):
        # 从 metadata 中获取对话 ID
        conv_id = state.metadata.get("conversation_id", 0)

        # 获取对应的对话消息
        if conv_id < len(conversations_data):
            messages = conversations_data[conv_id]
            # 将对话消息添加到 state
            state.messages.extend(messages)

        return state

    return solve


def run_conversation_judge():
    """运行对话评判"""
    print("=" * 80)
    print("Petri Conversation Judge - 对话记录评判")
    print("=" * 80)

    # 加载配置
    config = load_config()

    # 读取输入文件
    if not INPUT_JSON_PATH.exists():
        raise FileNotFoundError(f"输入文件不存在: {INPUT_JSON_PATH}")

    with open(INPUT_JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not isinstance(data, list):
        data = [data]

    # 解析所有对话
    conversations_data = []
    dataset = []

    for idx, item in enumerate(data):
        try:
            # 解析对话
            messages = parse_conversation(item)

            if not messages:
                print(f"警告: 对话 {idx} 为空，跳过")
                continue

            conversations_data.append(messages)

            # 创建 Sample
            summary = f"Conversation {idx + 1}"
            if isinstance(item, dict) and item.get("title"):
                summary = item["title"]

            dataset.append(
                Sample(
                    input=summary,
                    metadata={
                        "conversation_id": idx,
                        "message_count": len(messages)
                    }
                )
            )

        except Exception as e:
            print(f"警告: 解析对话 {idx} 失败: {e}")
            continue

    if not dataset:
        raise ValueError("没有有效的对话数据")

    print(f"\n[OK] 成功加载 {len(dataset)} 个对话")

    # 创建评判任务
    task = Task(
        dataset=dataset,
        solver=conversation_loader(conversations_data),  # 传入对话数据
        scorer=compliance_judge(dimensions=config.get("dimensions"))
    )

    # 运行评判
    print("\n开始评判对话...")

    # 获取 judge 模型配置 - 使用 claude-3-5-sonnet 因为它更稳定
    judge_model = config.get("judge_model", "anthropic/claude-3-5-sonnet-20241022")
    print(f"使用评判模型: {judge_model}")

    results = eval(
        tasks=task,
        model=None,  # 不需要 target 模型，因为不生成对话
        model_roles={"judge": judge_model},  # 指定 judge 模型
        log_dir=str(OUTPUT_DIR),
        limit=None  # 移除样本数量限制，处理所有对话
    )

    print("\n[OK] 评判完成")

    # eval() 返回一个列表，取第一个结果
    result = results[0] if isinstance(results, list) and results else results

    # 分析结果
    analysis = analyze_results(result)

    # 保存报告
    save_report(analysis)

    return analysis


def analyze_results(result):
    """分析评判结果"""
    print("\n" + "=" * 80)
    print("分析评判结果...")
    print("=" * 80)

    if not result or not hasattr(result, 'samples'):
        print("错误: 评判结果无效")
        return {
            "overall_score": 0,
            "total_conversations": 0,
            "evaluation_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "details": [],
            "error": "评判失败，没有有效结果"
        }

    scores = []
    details = []

    for sample in result.samples:
        if hasattr(sample, 'scores') and sample.scores:
            # scores 是一个字典，键是 scorer 名称
            if isinstance(sample.scores, dict):
                for score_name, score_obj in sample.scores.items():
                    if hasattr(score_obj, 'value'):
                        score_value = score_obj.value
                        scores.append(score_value)

                        metadata = score_obj.metadata if hasattr(score_obj, 'metadata') else {}

                        # 获取对话标题
                        conversation_title = "Unknown"
                        if hasattr(sample, 'metadata') and sample.metadata:
                            conv_id = sample.metadata.get('conversation_id', 0)
                            conversation_title = f"Conversation {conv_id + 1}"

                        details.append({
                            "conversation": conversation_title,
                            "score": round(score_value, 2),
                            "dimension_scores": metadata.get('dimension_scores', {}),
                            "risk_tier": metadata.get('risk_tier', 'N/A'),
                            "needs_review": metadata.get('needs_human_review', False),
                            "overall_assessment": metadata.get('overall_assessment', '')
                        })

    overall_score = sum(scores) / len(scores) if scores else 0

    analysis = {
        "overall_score": round(overall_score, 2),
        "total_conversations": len(result.samples),
        "evaluation_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "details": details
    }

    print(f"\n[OK] 总体评分: {analysis['overall_score']}/5.0")
    print(f"[OK] 评判对话数: {analysis['total_conversations']}")

    # 打印每个对话的评分
    for detail in details:
        print(f"\n  {detail['conversation']}: {detail['score']}/5.0 (风险等级: {detail['risk_tier']})")

    return analysis


def save_report(analysis):
    """保存评判报告"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = OUTPUT_DIR / f"conversation_judge_report_{timestamp}.json"

    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] 报告已保存: {report_path}")


if __name__ == "__main__":
    try:
        run_conversation_judge()
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

