from solution import Account


@test("a new account starts at 0")
def _():
    expect(Account("Ana").balance).to_equal(0)


@test("deposit adds and withdraw takes away")
def _():
    account = Account("Ana")
    account.deposit(50)
    account.withdraw(20)
    expect(account.balance).to_equal(30)


@test("withdrawing too much raises ValueError and changes nothing")
def _():
    account = Account("Ben")
    account.deposit(10)
    expect(lambda: account.withdraw(25)).to_raise(ValueError)
    expect(account.balance).to_equal(10)


@test("two accounts keep separate balances")
def _():
    first = Account("Ana")
    second = Account("Ben")
    first.deposit(40)
    expect(second.balance).to_equal(0)
