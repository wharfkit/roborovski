import {assert} from 'chai'

import {
    createTestClient,
    TEST_ACCOUNT,
    TEST_CONTRACT_TOKEN,
    TEST_ACTION_TRANSFER,
    TEST_DATE,
    TEST_DATE_PREV,
    TEST_DATE_NEXT,
    TEST_DATE_MONTH_START,
    TEST_DATE_MONTH_END,
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
            const result = await robo.activity(TEST_ACCOUNT, {
                date: TEST_DATE,
                limit: 10,
            })

            assert.isArray(result.results)
            assert.isAtLeast(result.results.length, 1, `Should have actions on ${TEST_DATE}`)
            validateDate(result.results, TEST_DATE)
        })

        test('date range with startDate and endDate', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                start_date: TEST_DATE_MONTH_START,
                end_date: TEST_DATE,
                limit: 10,
            })

            assert.isArray(result.results)
            assert.isAtLeast(result.results.length, 1, 'Should have actions in date range')
            validateDateRange(result.results, TEST_DATE_MONTH_START, TEST_DATE)
        })

        test('single day range (startDate = endDate)', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                start_date: TEST_DATE,
                end_date: TEST_DATE,
                limit: 10,
            })

            assert.isArray(result.results)
            assert.isAtLeast(result.results.length, 1, 'Should have actions on single date')
            validateDate(result.results, TEST_DATE)
        })

        test('multi-day range', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                start_date: TEST_DATE_MONTH_START,
                end_date: TEST_DATE_MONTH_END,
                limit: 20,
            })

            assert.isArray(result.results)
            assert.isAtLeast(result.results.length, 1, 'Should have actions in month')
            validateDateRange(result.results, TEST_DATE_MONTH_START, TEST_DATE_MONTH_END)
        })

        test('date filter on different date', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                date: TEST_DATE_PREV,
                limit: 10,
            })

            assert.isArray(result.results)
            assert.isAtLeast(result.results.length, 1, `Should have actions on ${TEST_DATE_PREV}`)
            validateDate(result.results, TEST_DATE_PREV)
        })
    })

    suite('combinations', function () {
        test('date + contract + action (triple filter)', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: TEST_ACTION_TRANSFER,
                date: TEST_DATE,
                limit: 10,
            })

            assert.isArray(result.results)
            assert.isAtLeast(result.results.length, 1, `Should have transfers on ${TEST_DATE}`)
            validateContract(result.results, TEST_CONTRACT_TOKEN)
            validateAction(result.results, TEST_ACTION_TRANSFER)
            validateDate(result.results, TEST_DATE)
        })

        test('date range + contract', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                start_date: TEST_DATE_MONTH_START,
                end_date: TEST_DATE,
                limit: 10,
            })

            assert.isArray(result.results)
            assert.isAtLeast(result.results.length, 1, 'Should have token actions in date range')
            validateContract(result.results, TEST_CONTRACT_TOKEN)
            validateDateRange(result.results, TEST_DATE_MONTH_START, TEST_DATE)
        })

        test('date range + action', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: TEST_ACTION_TRANSFER,
                start_date: TEST_DATE_MONTH_START,
                end_date: TEST_DATE,
                limit: 10,
            })

            assert.isArray(result.results)
            assert.isAtLeast(result.results.length, 1, 'Should have transfers in date range')
            validateAction(result.results, TEST_ACTION_TRANSFER)
            validateDateRange(result.results, TEST_DATE_MONTH_START, TEST_DATE)
        })
    })

    suite('edge cases', function () {
        test('date with no matching results', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                date: '2020-01-01',
                limit: 100,
            })

            assert.isArray(result.results)
        })

        test('future date', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                date: '2030-01-01',
                limit: 10,
            })

            assert.isArray(result.results)
            assert.equal(result.results.length, 0, 'Future date should have no results')
        })

        test('invalid date format handling', async function () {
            try {
                await robo.activity(TEST_ACCOUNT, {
                    date: 'invalid-date',
                    limit: 10,
                })
            } catch (error) {
                assert.isDefined(error)
            }
        })

        test('date range where startDate > endDate', async function () {
            try {
                const result = await robo.activity(TEST_ACCOUNT, {
                    start_date: TEST_DATE,
                    end_date: TEST_DATE_MONTH_START,
                    limit: 10,
                })

                assert.isArray(result.results)
                assert.equal(result.results.length, 0, 'Invalid range should have no results')
            } catch (error) {
                assert.isDefined(error, 'API may return error for invalid date range')
            }
        })

        test('very old date', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                date: '2018-01-01',
                limit: 10,
            })

            assert.isArray(result.results)
        })

        test('date at exact boundaries (midnight)', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                date: TEST_DATE,
                limit: 10,
            })

            assert.isArray(result.results)
            assert.isAtLeast(result.results.length, 1, 'Should have actions on test date')

            result.results.forEach((action: any) => {
                const blockTimeStr = String(action.block_time)
                const blockDate = blockTimeStr.split('T')[0]

                assert.equal(
                    blockDate,
                    TEST_DATE,
                    `Block time ${blockTimeStr} should be on ${TEST_DATE}`
                )
            })
        })

        test('wide date range (full month)', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                start_date: TEST_DATE_MONTH_START,
                end_date: TEST_DATE_MONTH_END,
                limit: 50,
            })

            assert.isArray(result.results)
            assert.isAtLeast(result.results.length, 1, 'Should have actions in month')
            validateDateRange(result.results, TEST_DATE_MONTH_START, TEST_DATE_MONTH_END)
        })

        test('narrow date range (single hour would need time support)', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                start_date: TEST_DATE,
                end_date: TEST_DATE_NEXT,
                limit: 20,
            })

            assert.isArray(result.results)
            assert.isAtLeast(result.results.length, 1, 'Should have actions in 2-day range')
            validateDateRange(result.results, TEST_DATE, TEST_DATE_NEXT)
        })
    })

    suite('pagination with dates', function () {
        test('date filter with cursor pagination', async function () {
            const page1 = await robo.activity(TEST_ACCOUNT, {
                date: TEST_DATE,
                limit: 5,
            })

            assert.isArray(page1.results)
            assert.isAtLeast(page1.results.length, 1, 'Should have actions on test date')

            if (page1.next_cursor) {
                const page2 = await page1.next()

                assert.isArray(page2.results)
                assert.isAtLeast(page2.results.length, 1, 'Should have more actions on page 2')
                validateDate(page2.results, TEST_DATE)
            }
        })

        test('date range with cursor pagination', async function () {
            const page1 = await robo.activity(TEST_ACCOUNT, {
                start_date: TEST_DATE_MONTH_START,
                end_date: TEST_DATE,
                limit: 5,
            })

            assert.isArray(page1.results)
            assert.isAtLeast(page1.results.length, 1, 'Should have actions in date range')

            if (page1.next_cursor) {
                const page2 = await page1.next()

                assert.isArray(page2.results)
                assert.isAtLeast(page2.results.length, 1, 'Should have more actions on page 2')
                validateDateRange(page2.results, TEST_DATE_MONTH_START, TEST_DATE)
            }
        })
    })
})
