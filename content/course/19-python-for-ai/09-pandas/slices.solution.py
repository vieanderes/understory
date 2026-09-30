import pandas as pd


def pass_rates(df, version):
    rows = df[df["version"] == version]
    return rows.groupby("category")["passed"].mean()
