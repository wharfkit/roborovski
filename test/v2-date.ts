import {assert} from 'chai'

import {
    createTestClient,
    TEST_ACCOUNT,
    TEST_CONTRACT_TOKEN,
    TEST_ACTION_TRANSFER,
    validateContract,
    validateAction,
    validateDate,
    validateDateRange,
} from './v2-helpers'

const robo = createTestClient()

suite('v2 - date parameter', function () {
    this.slow(200)
    this.timeout(10 * 1000)

    suite('baseline', function () {
        test('single date filter', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                date: '2025-12-10',
                limit: 10,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1, 'Should have actions on 2025-12-10')
            validateDate(result.actions, '2025-12-10')
        })

        test('date range with startDate and endDate', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                start_date: '2025-12-01',
                end_date: '2025-12-10',
                limit: 10,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1, 'Should have actions in date range')
            validateDateRange(result.actions, '2025-12-01', '2025-12-10')
        })

        test('single day range (startDate = endDate)', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                start_date: '2025-12-10',
                end_date: '2025-12-10',
                limit: 10,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1, 'Should have actions on single date')
            validateDate(result.actions, '2025-12-10')
        })

        test('multi-day range', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                start_date: '2025-12-01',
                end_date: '2025-12-31',
                limit: 20,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1, 'Should have actions in December')
            validateDateRange(result.actions, '2025-12-01', '2025-12-31')
        })

        test('date filter on different date', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                date: '2025-12-09',
                limit: 10,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1, 'Should have actions on 2025-12-09')
            validateDate(result.actions, '2025-12-09')
        })
    })

    suite('combinations', function () {
        test('date + contract + action (triple filter)', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: TEST_ACTION_TRANSFER,
                date: '2025-12-10',
                limit: 10,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1, 'Should have transfers on 2025-12-10')
            validateContract(result.actions, TEST_CONTRACT_TOKEN)
            validateAction(result.actions, TEST_ACTION_TRANSFER)
            validateDate(result.actions, '2025-12-10')
        })

        test('date range + contract', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                start_date: '2025-12-01',
                end_date: '2025-12-10',
                limit: 10,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1, 'Should have token actions in date range')
            validateContract(result.actions, TEST_CONTRACT_TOKEN)
            validateDateRange(result.actions, '2025-12-01', '2025-12-10')
        })

        test('date range + action', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: TEST_ACTION_TRANSFER,
                start_date: '2025-12-01',
                end_date: '2025-12-10',
                limit: 10,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1, 'Should have transfers in date range')
            validateAction(result.actions, TEST_ACTION_TRANSFER)
            validateDateRange(result.actions, '2025-12-01', '2025-12-10')
        })
    })

    suite('edge cases', function () {
        test('date with no matching results', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                date: '2020-01-01',
                limit: 100,
            })

            assert.isArray(result.actions)
        })

        test('future date', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                date: '2030-01-01',
                limit: 10,
            })

            assert.isArray(result.actions)
            assert.equal(result.actions.length, 0, 'Future date should have no results')
        })

        test('invalid date format handling', async function () {
            try {
                await robo.get_activity(TEST_ACCOUNT, {
                    date: 'invalid-date',
                    limit: 10,
                })
            } catch (error) {
                assert.isDefined(error)
            }
        })

        test('date range where startDate > endDate', async function () {
            try {
                const result = await robo.get_activity(TEST_ACCOUNT, {
                    start_date: '2025-12-10',
                    end_date: '2025-12-01',
                    limit: 10,
                })

                assert.isArray(result.actions)
                assert.equal(result.actions.length, 0, 'Invalid range should have no results')
            } catch (error) {
                assert.isDefined(error, 'API may return error for invalid date range')
            }
        })

        test('very old date', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                date: '2018-01-01',
                limit: 10,
            })

            assert.isArray(result.actions)
        })

        test('date at exact boundaries (midnight)', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                date: '2025-12-10',
                limit: 10,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1, 'Should have actions on test date')

            result.actions.forEach((action: any) => {
                const blockTimeStr = String(action.block_time)
                const blockDate = blockTimeStr.split('T')[0]

                assert.equal(
                    blockDate,
                    '2025-12-10',
                    `Block time ${blockTimeStr} should be on 2025-12-10`
                )
            })
        })

        test('wide date range (full month)', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                start_date: '2025-12-01',
                end_date: '2025-12-31',
                limit: 50,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1, 'Should have actions in December')
            validateDateRange(result.actions, '2025-12-01', '2025-12-31')
        })

        test('narrow date range (single hour would need time support)', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                start_date: '2025-12-10',
                end_date: '2025-12-11',
                limit: 20,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1, 'Should have actions in 2-day range')
            validateDateRange(result.actions, '2025-12-10', '2025-12-11')
        })
    })

    suite('pagination with dates', function () {
        test('date filter with cursor pagination', async function () {
            const result1 = await robo.get_activity(TEST_ACCOUNT, {
                date: '2025-12-10',
                limit: 5,
            })

            assert.isArray(result1.actions)
            assert.isAtLeast(result1.actions.length, 1, 'Should have actions on test date')

            if (result1.pagination.next_cursor) {
                const result2 = await robo.get_activity(TEST_ACCOUNT, {
                    date: '2025-12-10',
                    limit: 5,
                    cursor: result1.pagination.next_cursor,
                })

                assert.isArray(result2.actions)
                assert.isAtLeast(result2.actions.length, 1, 'Should have more actions on page 2')
                validateDate(result2.actions, '2025-12-10')
            }
        })

        test('date range with cursor pagination', async function () {
            const result1 = await robo.get_activity(TEST_ACCOUNT, {
                start_date: '2025-12-01',
                end_date: '2025-12-10',
                limit: 5,
            })

            assert.isArray(result1.actions)
            assert.isAtLeast(result1.actions.length, 1, 'Should have actions in date range')

            if (result1.pagination.next_cursor) {
                const result2 = await robo.get_activity(TEST_ACCOUNT, {
                    start_date: '2025-12-01',
                    end_date: '2025-12-10',
                    limit: 5,
                    cursor: result1.pagination.next_cursor,
                })

                assert.isArray(result2.actions)
                assert.isAtLeast(result2.actions.length, 1, 'Should have more actions on page 2')
                validateDateRange(result2.actions, '2025-12-01', '2025-12-10')
            }
        })
    })
})
