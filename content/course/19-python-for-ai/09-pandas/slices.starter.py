import pandas as pd


def pass_rates(df, version):
    # Your code here: this mixes every version together.
    return df.groupby("category")["passed"].mean()
