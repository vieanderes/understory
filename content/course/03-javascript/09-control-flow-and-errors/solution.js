function settleOrder(charge, release) {
  try {
    return { status: "paid", receipt: charge() };
  } catch (thrown) {
    // Handle the one failure this function understands, and pass every other one up.
    if (thrown instanceof Error && thrown.code === "card_declined") {
      return { status: "declined", reason: thrown.message };
    }
    throw new Error("checkout failed", { cause: thrown });
  } finally {
    // Runs after the return and after the throw. It has no return of its own.
    release();
  }
}
