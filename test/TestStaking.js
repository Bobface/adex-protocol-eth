const { providers, Contract } = require('ethers')

const Staking = artifacts.require('Staking')
const MockToken = artifacts.require('./mocks/Token')

const { expectEVMError, moveTime } = require('./')

const web3Provider = new providers.Web3Provider(web3.currentProvider)

const DAY_SECONDS = 24 * 60 * 60

contract('Staking', function(accounts) {
	const userAddr = accounts[1]
	const slasherAddr = accounts[2]
	const poolId = '0x0202020202020202020202020202020202020202020202020202020202020203'
	let staking
	let token

	before(async function() {
		const signer = web3Provider.getSigner(userAddr)
		const tokenWeb3 = await MockToken.new()
		token = new Contract(tokenWeb3.address, MockToken._json.abi, signer)
		const stakingWeb3 = await Staking.new(tokenWeb3.address, slasherAddr)
		staking = new Contract(stakingWeb3.address, Staking._json.abi, signer)
	})

	it('cannot slash', async function() {
		await expectEVMError(staking.slash(poolId, 10), 'ONLY_SLASHER')
	})

	it('open a bond, unbond it', async function() {
		const user = accounts[1]
		const bondAmount = 1200000
		const bond = [bondAmount, poolId]

		// insufficient funds
		await expectEVMError(staking.addBond(bond), 'INSUFFICIENT_FUNDS')
		// bond does not exist
		await expectEVMError(staking.requestUnbond(bond), 'BOND_NOT_ACTIVE')

		await token.setBalanceTo(user, bondAmount)

		const receipt = await (await staking.bond(bond)).wait()
		console.log(receipt.gasUsed.toString(10))

		// @TODO: check if bond exists
		assert.equal((await staking.getWithdrawAmount(bond)).toNumber(), bondAmount, 'bondAmount matches')
		assert.equal((await token.balanceOf(user)).toNumber(), 0, 'user has no tokens now')

		// we cannot unbond yet
		await expectEVMError(staking.unbond(bond), 'BOND_NOT_UNLOCKED')

		const receiptUnlock = await (await staking.requestUnbond(bond)).wait()
		console.log(receiptUnlock.gasUsed.toString(10))

		// we still can't unbond yet
		await expectEVMError(staking.unbond(bond), 'BOND_NOT_UNLOCKED')

		// after this, we will finally be able to unbond
		await moveTime(web3, DAY_SECONDS * 31)

		const receiptUnbond = await (await staking.unbond(bond)).wait()
		console.log(receiptUnbond.gasUsed.toString(10))

		assert.equal((await token.balanceOf(user)).toNumber(), bondAmount, 'user has their bond amount returned')

		// await expectEVMError(stakingUser.setWhitelisted(validator, true))
		// assert.equal(await staking.whitelisted(validator), false)
		// await (await staking.setWhitelisted(validator, false)).wait()
	})
})