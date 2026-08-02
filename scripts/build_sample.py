"""Build a stratified sample of the Indian job market CSV for the repo sample-data/ folder."""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.ingestion import classify_role

SRC = Path("data/indian_job_market_2025.csv")
OUT = Path("sample-data/indian_job_market_sample.csv")
TARGET = 2000
SEED = 42


def main() -> None:
    df = pd.read_csv(SRC, low_memory=False)
    df = df[df["job_description"].notna() & (df["job_description"].astype(str).str.strip() != "")]
    df["_cat"] = df["title"].astype(str).apply(classify_role)

    # Stratified sample proportional to category distribution
    sample = (
        df.groupby("_cat", group_keys=False)
        .apply(
            lambda g: g.sample(max(1, round(TARGET * len(g) / len(df))), random_state=SEED),
            include_groups=False,
        )
        .reset_index(drop=True)
    )

    # Trim to exact target, preserving spread
    if len(sample) > TARGET:

        def cap(g):
            return g.head(max(1, int(TARGET * len(g) / len(sample))))

        sample = (
            sample.groupby("_cat", group_keys=False)
            .apply(cap, include_groups=False)
            .reset_index(drop=True)
            .head(TARGET)
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    sample.to_csv(OUT, index=False)
    print(f"saved: {OUT} ({OUT.stat().st_size // 1024} KB, {len(sample)} rows)")


if __name__ == "__main__":
    main()
