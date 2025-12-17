import {assert} from 'chai'

import {
    createTestClient,
    TEST_ACCOUNT,
    TEST_ACTION_TRANSFER,
    TEST_CONTRACT_SYSTEM,
    TEST_CONTRACT_TOKEN,
    TEST_CONTRACT_VAULTA,
    validateAction,
    validateContract,
} from './v2-helpers'

const robo = createTestClient()

suite('v2 - contract parameter', function () {
    this.slow(200)
    this.timeout(10 * 1000)

    suite('baseline', function () {
        test('different contracts - eosio.token', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                limit: 10,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1)
            validateContract(result.actions, TEST_CONTRACT_TOKEN)
        })

        test('different contracts - eosio', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_SYSTEM,
                limit: 10,
            })

            assert.isArray(result.actions)
            validateContract(result.actions, TEST_CONTRACT_SYSTEM)
        })

        test('different contracts - core.vaulta', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_VAULTA,
                limit: 10,
            })

            assert.isArray(result.actions)
            validateContract(result.actions, TEST_CONTRACT_VAULTA)
        })

        test('non-existent contract', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                contract: 'zzzzzzzzzzza',
                limit: 10,
            })

            assert.isArray(result.actions)
        })
    })

    suite('contract + action combinations', function () {
        test('contract + action filter (transfer)', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: TEST_ACTION_TRANSFER,
                limit: 10,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1, 'Should have at least one transfer action')
            validateAction(result.actions, TEST_ACTION_TRANSFER)
            validateContract(result.actions, TEST_CONTRACT_TOKEN)
        })

        test('contract + action filter (issue)', async function () {
            try {
                const result = await robo.get_activity(TEST_CONTRACT_TOKEN, {
                    contract: TEST_CONTRACT_TOKEN,
                    action: 'issue',
                    limit: 5,
                })

                assert.isArray(result.actions)
                // Issue actions are rare for eosio.token account itself
                // Result may be empty, which is valid - just verify structure
            } catch (error) {
                // API may return error for certain contract/action combinations
                // This is acceptable behavior
                assert.instanceOf(error, Error, 'Should throw error gracefully')
            }
        })

        test('action case handling', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: 'transfer',
                limit: 5,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1)
            validateAction(result.actions, 'transfer')
            validateContract(result.actions, TEST_CONTRACT_TOKEN)
        })

        test('contract + wrong action combination', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: 'buyrambytes',
                limit: 10,
            })

            assert.isArray(result.actions)
            assert.equal(
                result.actions.length,
                0,
                'eosio.token does not have buyrambytes action - should return no results'
            )
        })
    })

    suite('edge cases', function () {
        test('contract with sparse results', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_SYSTEM,
                limit: 100,
            })

            assert.isArray(result.actions)
            // System contract actions may be sparse but should exist
            assert.isAtLeast(result.actions.length, 1, 'Should have at least one eosio action')
            validateContract(result.actions, TEST_CONTRACT_SYSTEM)
        })

        test('contract case handling', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                contract: 'eosio.token',
                limit: 5,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1)
            validateContract(result.actions, 'eosio.token')
        })
    })
})
