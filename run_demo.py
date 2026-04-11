"""
UNICC AI Safety Lab — Standalone Demo Runner
=============================================
Runs a pre-generated safety evaluation without requiring an API key or
a running server. Loads the sample article, returns the full EnsembleReport,
and exits cleanly.

Usage:
    python run_demo.py
"""
import sys
import os
import json
import uuid
from datetime import datetime
from pathlib import Path

# Resolve paths relative to this file
ROOT       = Path(__file__).parent
BACKEND    = ROOT / "src" / "backend"
DATA_DIR   = ROOT / "data"
ARTICLE    = DATA_DIR / "HIGH Civilizing the Indian - The Carlisle School_s Mission to Transform the \"Savage\" into American Citizens.docx"
REPORT     = DATA_DIR / "safety-report-08FDA4CB.json"

sys.path.insert(0, str(BACKEND))


def load_article_text() -> str:
    """Extract plain text from the sample .docx article."""
    try:
        from docx import Document
        import io
        doc  = Document(str(ARTICLE))
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        return text
    except Exception as e:
        return f"[Could not read article: {e}]"


def load_demo_report(content_preview: str) -> dict:
    """Load the pre-generated report and patch dynamic fields."""
    with open(REPORT, "r", encoding="utf-8") as f:
        report = json.load(f)

    report["evaluation_id"]    = str(uuid.uuid4())[:8].upper()
    report["timestamp"]        = datetime.utcnow().isoformat() + "Z"
    report["content_preview"]  = content_preview[:300]
    return report


def print_section(title: str, content: str):
    width = 72
    print("\n" + "=" * width)
    print(f"  {title}")
    print("=" * width)
    print(content)


def main():
    print("\n╔══════════════════════════════════════════════════════════════════════╗")
    print("║          UNICC AI Safety Lab — Demonstration Run                    ║")
    print("║          NYU × UNICC | Spring 2026 Capstone                         ║")
    print("╚══════════════════════════════════════════════════════════════════════╝")

    # Step 1: Load article
    print("\n[1/3] Loading sample article...")
    article_text = load_article_text()
    preview      = article_text[:200].replace("\n", " ")
    print(f"      Article preview: \"{preview}...\"")

    # Step 2: Run evaluation (demo mode)
    print("\n[2/3] Running Mixture-of-Experts safety evaluation (demo mode)...")
    print("      → Judge 1: Adversarial Red Team Judge")
    print("      → Judge 2: Governance & Risk Classification Judge")
    print("      → Judge 3: Regulatory Compliance Judge")
    print("      → Arbitration: cross-judge critique")
    print("      → Synthesis: final ensemble verdict")

    report = load_demo_report(article_text)

    # Step 3: Print results
    print("\n[3/3] Evaluation complete.\n")

    print_section("INPUT DOCUMENT", f"  File    : {ARTICLE.name}\n  Type    : Document\n  Preview : {article_text[:300].strip()}")

    print_section("ENSEMBLE VERDICT", (
        f"  Evaluation ID     : {report['evaluation_id']}\n"
        f"  Timestamp         : {report['timestamp']}\n"
        f"  Final Risk Tier   : {report['final_risk_tier']}\n"
        f"  Final Score       : {report['final_score']} / 100\n"
        f"  Deployment Verdict: {report['deployment_verdict']}\n"
        f"  Judge Agreement   : {report['judge_agreement_level']}"
    ))

    judges_summary = ""
    for v in report["verdicts"]:
        judges_summary += (
            f"\n  [{v['judge_id']}] {v['judge_name']}\n"
            f"      Score : {v['overall_score']} / 100\n"
            f"      Tier  : {v['risk_tier']}\n"
            f"      Summary: {v['summary']}\n"
        )
    print_section("INDIVIDUAL JUDGE VERDICTS", judges_summary)

    deductions_text = ""
    for d in report["top_deductions"]:
        deductions_text += (
            f"\n  #{d['rank']} [{d['severity']}] {d['dimension']}\n"
            f"      \"{d['excerpt']}\"\n"
            f"      → {d['violation']}\n"
            f"      Flagged by: {', '.join(d['judges'])}\n"
        )
    print_section("TOP DEDUCTIONS (cross-judge)", deductions_text)

    consensus_text = "\n".join(f"  • {f}" for f in report["consensus_findings"])
    print_section("CONSENSUS FINDINGS", consensus_text)

    print_section("FINAL RECOMMENDATION", f"  {report['final_recommendation']}")

    # Save full JSON report
    out_path = ROOT / "data" / f"demo-output-{report['evaluation_id']}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Full report saved to: {out_path.name}")
    print("✓ Demo run complete.\n")


if __name__ == "__main__":
    main()
