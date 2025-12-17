import {assert} from 'chai'

import {
    createTestClient,
    TEST_ACCOUNT,
    TEST_CONTRACT_TOKEN,
    validateContract,
    validateAction,
    validateNoDuplicatesBetweenPages,
    validateUniqueGlobalSeqs,
    validateDescendingOrder,
    validateAscendingOrder,
    paginateAll,
} from './v2-helpers'

const robo = createTestClient()

suite('v2 - cursor parameter', function () {
    this.slow(200)
    this.timeout(10 * 1000)

    suite('pagination basics', function () {
        test('first page returns cursor when more results exist', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                limit: 5,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1)

            // With small limit on active account, there should be more results
            assert.isNotNull(
                result.pagination.next_cursor,
                'Should have next_cursor with small limit'
            )
            assert.isString(result.pagination.next_cursor, 'next_cursor should be a string')
            assert.isNotEmpty(result.pagination.next_cursor, 'next_cursor should not be empty')
        })

        test('last page has no next_cursor', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: 'transfer',
                date: '2025-12-10',
                limit: 10000,
            })

            assert.isArray(result.actions)
            assert.isAtLeast(result.actions.length, 1, 'Should have transfer actions on test date')

            // On last page, next_cursor is either null or undefined (backend returns empty pagination object)
            assert.isNotOk(
                result.pagination.next_cursor,
                'Constrained query with large limit should have no next_cursor (last page)'
            )
        })

        test('fetch second page with cursor', async function () {
            const page1 = await robo.get_activity(TEST_ACCOUNT, {
                limit: 10,
            })

            assert.isArray(page1.actions)
            assert.isAtLeast(page1.actions.length, 1)
            assert.isNotNull(page1.pagination.next_cursor, 'First page should have next_cursor')
            assert.isUndefined(
                page1.pagination.prev_cursor,
                'First page should not have prev_cursor'
            )

            const page2 = await robo.get_activity(TEST_ACCOUNT, {
                cursor: page1.pagination.next_cursor!,
                limit: 10,
            })

            assert.isArray(page2.actions)
            assert.isAtLeast(page2.actions.length, 1)
            assert.isDefined(page2.pagination.prev_cursor, 'Second page should have prev_cursor')
            assert.isString(page2.pagination.prev_cursor, 'prev_cursor should be string')
            assert.isNotEmpty(page2.pagination.prev_cursor, 'prev_cursor should not be empty')
            validateNoDuplicatesBetweenPages(page1.actions, page2.actions)
        })

        test('pagination maintains order (ascending)', async function () {
            const page1 = await robo.get_activity(TEST_ACCOUNT, {
                limit: 10,
                order: 'asc',
            })

            assert.isArray(page1.actions)
            validateAscendingOrder(page1.actions)
            assert.isNotNull(page1.pagination.next_cursor, 'Should have more results with limit=10')

            const page2 = await robo.get_activity(TEST_ACCOUNT, {
                cursor: page1.pagination.next_cursor!,
                limit: 10,
                order: 'asc',
            })

            assert.isArray(page2.actions)
            validateAscendingOrder(page2.actions)

            const lastSeqPage1 = Number(page1.actions[page1.actions.length - 1].account_action_seq)
            const firstSeqPage2 = Number(page2.actions[0].account_action_seq)

            assert.isBelow(
                lastSeqPage1,
                firstSeqPage2,
                'Page 2 first action should have higher seq than page 1 last action'
            )
        })

        test('pagination maintains order (descending)', async function () {
            const page1 = await robo.get_activity(TEST_ACCOUNT, {
                limit: 10,
                order: 'desc',
            })

            assert.isArray(page1.actions)
            validateDescendingOrder(page1.actions)
            assert.isNotNull(page1.pagination.next_cursor, 'Should have more results with limit=10')

            const page2 = await robo.get_activity(TEST_ACCOUNT, {
                cursor: page1.pagination.next_cursor!,
                limit: 10,
                order: 'desc',
            })

            assert.isArray(page2.actions)
            validateDescendingOrder(page2.actions)
            validateNoDuplicatesBetweenPages(page1.actions, page2.actions)
        })
    })

    suite('complete pagination', function () {
        test('paginate through all results (small dataset)', async function () {
            const allActions = await paginateAll(robo, TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: 'transfer',
                date: '2025-12-10',
            })

            assert.isArray(allActions)
            validateUniqueGlobalSeqs(allActions)
            validateContract(allActions, TEST_CONTRACT_TOKEN)
            validateAction(allActions, 'transfer')
        })

        test('paginate with small page size', async function () {
            const allActions = await paginateAll(robo, TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: 'transfer',
                date: '2025-12-10',
                limit: 3,
            })

            assert.isArray(allActions)
            validateUniqueGlobalSeqs(allActions)
            validateContract(allActions, TEST_CONTRACT_TOKEN)
            validateAction(allActions, 'transfer')
            assert.isAtLeast(allActions.length, 3, 'Should have fetched multiple pages')
        })

        test('paginate with filters (comprehensive uniqueness)', async function () {
            const allActions = await paginateAll(robo, TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: 'transfer',
                date: '2025-12-10',
                order: 'asc',
                limit: 3,
            })

            assert.isArray(allActions)
            assert.isAtLeast(allActions.length, 6, 'Should have fetched multiple pages')

            validateContract(allActions, TEST_CONTRACT_TOKEN)
            validateAction(allActions, 'transfer')
            validateUniqueGlobalSeqs(allActions)
            validateAscendingOrder(allActions)

            const globalSeqs = allActions.map((a) => Number(a.global_action_seq))
            const accountSeqs = allActions.map((a) => Number(a.account_action_seq))

            assert.equal(
                globalSeqs.length,
                new Set(globalSeqs).size,
                'All global sequences should be unique across all pages'
            )
            assert.equal(
                accountSeqs.length,
                new Set(accountSeqs).size,
                'All account sequences should be unique across all pages'
            )
        })
    })

    suite('edge cases', function () {
        test('empty cursor string behavior', async function () {
            const result = await robo.get_activity(TEST_ACCOUNT, {
                cursor: '',
                limit: 5,
            })

            assert.isArray(result.actions)
        })

        test('invalid cursor format', async function () {
            try {
                await robo.get_activity(TEST_ACCOUNT, {
                    cursor: 'invalid-cursor-format',
                    limit: 5,
                })
                assert.fail('Should have thrown error for invalid cursor')
            } catch (error) {
                assert.instanceOf(error, Error)
            }
        })

        test('cursor with limit=1 (extreme pagination)', async function () {
            const page1 = await robo.get_activity(TEST_ACCOUNT, {
                limit: 1,
            })

            assert.isArray(page1.actions)
            assert.equal(page1.actions.length, 1, 'Should return exactly 1 action')
            assert.isNotNull(page1.pagination.next_cursor, 'Should have more results with limit=1')

            const page2 = await robo.get_activity(TEST_ACCOUNT, {
                cursor: page1.pagination.next_cursor!,
                limit: 1,
            })

            assert.isArray(page2.actions)
            assert.equal(page2.actions.length, 1, 'Should return exactly 1 action')
            validateNoDuplicatesBetweenPages(page1.actions, page2.actions)
        })

        test('cursor persists across different limits', async function () {
            const page1 = await robo.get_activity(TEST_ACCOUNT, {
                limit: 5,
            })

            assert.isArray(page1.actions)
            assert.isNotNull(page1.pagination.next_cursor, 'Should have more results')

            const page2 = await robo.get_activity(TEST_ACCOUNT, {
                cursor: page1.pagination.next_cursor!,
                limit: 10,
            })

            assert.isArray(page2.actions)
            validateNoDuplicatesBetweenPages(page1.actions, page2.actions)
        })

        test('order: desc cross-page uniqueness', async function () {
            const page1 = await robo.get_activity(TEST_ACCOUNT, {
                order: 'desc',
                limit: 10,
            })

            assert.isArray(page1.actions)
            assert.isAtLeast(page1.actions.length, 1)
            validateUniqueGlobalSeqs(page1.actions)
            validateDescendingOrder(page1.actions)
            assert.isNotNull(page1.pagination.next_cursor, 'Should have more results')

            const page2 = await robo.get_activity(TEST_ACCOUNT, {
                order: 'desc',
                limit: 10,
                cursor: page1.pagination.next_cursor!,
            })

            assert.isArray(page2.actions)
            assert.isAtLeast(page2.actions.length, 1, 'Second page should have results')
            validateUniqueGlobalSeqs(page2.actions)
            validateDescendingOrder(page2.actions)
            validateNoDuplicatesBetweenPages(page1.actions, page2.actions)

            const lastSeqPage1 = Number(page1.actions[page1.actions.length - 1].account_action_seq)
            const firstSeqPage2 = Number(page2.actions[0].account_action_seq)

            assert.isAbove(
                lastSeqPage1,
                firstSeqPage2,
                'Page 2 should continue descending from page 1'
            )
        })

        test('cursor with all parameters (kitchen sink)', async function () {
            const page1 = await robo.get_activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: 'transfer',
                date: '2025-12-10',
                decode: true,
                order: 'desc',
                limit: 3,
            })

            assert.isArray(page1.actions)
            assert.isAtLeast(page1.actions.length, 1, 'Should have transfer actions on test date')

            validateContract(page1.actions, TEST_CONTRACT_TOKEN)
            validateAction(page1.actions, 'transfer')
            validateUniqueGlobalSeqs(page1.actions)
            validateDescendingOrder(page1.actions)

            page1.actions.forEach((action) => {
                const data = action.action_trace.act.data
                if (typeof data === 'object' && data !== null) {
                    assert.property(data, 'from', 'Should have decoded data')
                }
            })

            if (page1.pagination.next_cursor) {
                const page2 = await robo.get_activity(TEST_ACCOUNT, {
                    contract: TEST_CONTRACT_TOKEN,
                    action: 'transfer',
                    date: '2025-12-10',
                    decode: true,
                    order: 'desc',
                    limit: 3,
                    cursor: page1.pagination.next_cursor,
                })

                assert.isArray(page2.actions)
                assert.isAtLeast(page2.actions.length, 1, 'Should have more transfer actions')

                validateContract(page2.actions, TEST_CONTRACT_TOKEN)
                validateAction(page2.actions, 'transfer')
                validateUniqueGlobalSeqs(page2.actions)
                validateDescendingOrder(page2.actions)
                validateNoDuplicatesBetweenPages(page1.actions, page2.actions)
            }
        })
    })
})
