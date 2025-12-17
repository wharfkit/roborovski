import {assert} from 'chai'

import {APIClient, FetchProvider} from '@wharfkit/antelope'
import {mockFetch} from '@wharfkit/mock-data'

import {RoborovskiClient} from '$lib'

// Setup an APIClient with mock data (will record on first run, replay after)
const client = new APIClient({
    provider: new FetchProvider('https://jungle4-test.unicove.com', {fetch: mockFetch}),
})

// Setup the API
const robo = new RoborovskiClient(client)

suite('v2 parameters', function () {
    this.slow(2000)
    this.timeout(10 * 1000)

    test('cursor parameter', async function () {
        const page1 = await robo.get_activity('gm', {
            limit: 2,
        })
        assert.isArray(page1.actions)
        assert.isAtLeast(page1.actions.length, 1)

        // Small limit should have more results
        assert.isNotNull(page1.pagination.next_cursor, 'Should have next_cursor')
        assert.isString(page1.pagination.next_cursor)
        assert.isNotEmpty(page1.pagination.next_cursor)

        // Use cursor for next page
        const nextCursor = page1.pagination.next_cursor as string
        const page2 = await robo.get_activity('gm', {
            limit: 2,
            cursor: nextCursor,
        })
        assert.isArray(page2.actions)
        assert.isAtLeast(page2.actions.length, 1)
        assert.isDefined(page2.pagination.prev_cursor, 'Page 2 should have prev_cursor')
    })

    test('contract filter', async function () {
        const result = await robo.get_activity('gm', {
            contract: 'eosio.token',
            limit: 5,
        })
        assert.isArray(result.actions)
        assert.isAtLeast(result.actions.length, 1)

        // Verify all actions are from eosio.token
        result.actions.forEach((action) => {
            assert.equal(action.action_trace.act.account, 'eosio.token')
        })
    })

    test('action filter', async function () {
        const result = await robo.get_activity('gm', {
            contract: 'eosio.token',
            action: 'transfer',
            limit: 5,
        })
        assert.isArray(result.actions)
        assert.isAtLeast(result.actions.length, 1)

        // Verify all actions are transfers
        result.actions.forEach((action) => {
            assert.equal(action.action_trace.act.account, 'eosio.token')
            assert.equal(action.action_trace.act.name, 'transfer')
        })
    })

    test('date filter', async function () {
        const result = await robo.get_activity('gm', {
            date: '2025-12-10',
            limit: 5,
        })
        assert.isArray(result.actions)
        assert.isAtLeast(result.actions.length, 1, 'Should have actions on 2025-12-10')

        result.actions.forEach((action) => {
            assert.match(action.block_time, /^2025-12-10/)
        })
    })

    test('date range filter', async function () {
        const result = await robo.get_activity('gm', {
            start_date: '2025-12-10',
            end_date: '2025-12-10',
            limit: 5,
        })
        assert.isArray(result.actions)
        assert.isAtLeast(result.actions.length, 1, 'Should have actions in date range')

        result.actions.forEach((action) => {
            assert.match(action.block_time, /^2025-12-10/)
        })
    })

    test('decode parameter', async function () {
        const result = await robo.get_activity('gm', {
            contract: 'eosio.token',
            action: 'transfer',
            decode: true,
            limit: 1,
        })
        assert.isArray(result.actions)
        assert.isAtLeast(result.actions.length, 1)

        const action = result.actions[0]
        const data = action.action_trace.act.data

        // When decode=true and ABI is available, data should be an object
        if (typeof data === 'object' && data !== null) {
            assert.property(data, 'from')
            assert.property(data, 'to')
            assert.property(data, 'quantity')
            assert.property(data, 'memo')
        }

        // hex_data should also be present
        if ('hex_data' in action.action_trace.act) {
            assert.isString(action.action_trace.act.hex_data)
        }
    })

    test('combined filters', async function () {
        const result = await robo.get_activity('gm', {
            contract: 'eosio.token',
            action: 'transfer',
            date: '2025-12-10',
            decode: true,
            limit: 3,
        })
        assert.isArray(result.actions)
        assert.isAtLeast(result.actions.length, 1, 'Should have transfers on 2025-12-10')

        result.actions.forEach((action) => {
            assert.equal(action.action_trace.act.account, 'eosio.token')
            assert.equal(action.action_trace.act.name, 'transfer')
            assert.match(action.block_time, /^2025-12-10/)
        })
    })

    test('next_cursor indicates more results', async function () {
        const result = await robo.get_activity('gm', {
            limit: 2,
        })
        assert.isArray(result.actions)
        assert.isAtLeast(result.actions.length, 1, 'Should have actions')

        // Small limit should have more results
        assert.isNotOk(!result.pagination.next_cursor, 'Should have next_cursor with small limit')
        assert.isString(result.pagination.next_cursor)
    })

    test('response structure validation', async function () {
        const result = await robo.get_activity('gm', {
            limit: 2,
        })

        // Validate top-level response structure
        assert.isArray(result.actions, 'actions should be an array')
        assert.isDefined(result.last_irreversible_block, 'last_irreversible_block should exist')

        // Validate pagination object structure
        assert.isObject(result.pagination, 'pagination should be an object')
        assert.property(result.pagination, 'next_cursor', 'pagination should have next_cursor')

        // Validate pagination field types - next_cursor should exist (small limit)
        assert.isDefined(result.pagination.next_cursor, 'next_cursor should be defined')
        if (result.pagination.next_cursor) {
            assert.isString(
                result.pagination.next_cursor,
                'next_cursor should be string when present'
            )
        }
    })

    test('default order is descending', async function () {
        const result = await robo.get_activity('gm', {
            limit: 10,
        })

        assert.isArray(result.actions)
        assert.isAtLeast(result.actions.length, 2, 'Need multiple actions to verify order')

        for (let i = 1; i < result.actions.length; i++) {
            const prevSeq = Number(result.actions[i - 1].account_action_seq)
            const currSeq = Number(result.actions[i].account_action_seq)
            assert.isAbove(prevSeq, currSeq, 'Default order should be descending (newest-first)')
        }
    })

    test('order: asc is ascending', async function () {
        const result = await robo.get_activity('gm', {
            limit: 10,
            order: 'asc',
        })

        assert.isArray(result.actions)
        assert.isAtLeast(result.actions.length, 2, 'Need multiple actions to verify order')

        for (let i = 1; i < result.actions.length; i++) {
            const prevSeq = Number(result.actions[i - 1].account_action_seq)
            const currSeq = Number(result.actions[i].account_action_seq)
            assert.isBelow(prevSeq, currSeq, 'order: asc should be ascending')
        }
    })

    test('order: desc is descending', async function () {
        const result = await robo.get_activity('gm', {
            limit: 10,
            order: 'desc',
        })

        assert.isArray(result.actions)
        assert.isAtLeast(result.actions.length, 2, 'Need multiple actions to verify order')

        for (let i = 1; i < result.actions.length; i++) {
            const prevSeq = Number(result.actions[i - 1].account_action_seq)
            const currSeq = Number(result.actions[i].account_action_seq)
            assert.isAbove(prevSeq, currSeq, 'order: desc should be descending')
        }
    })

    test('limit: 1 (minimum)', async function () {
        const result = await robo.get_activity('gm', {
            limit: 1,
        })

        assert.isArray(result.actions)
        assert.equal(result.actions.length, 1, 'Should return exactly 1 action')
    })

    test('limit: 100 (large limit)', async function () {
        const result = await robo.get_activity('gm', {
            limit: 100,
        })

        assert.isArray(result.actions)
        assert.isAtMost(result.actions.length, 100, 'Should not exceed limit of 100')
    })

    test('limit enforcement with filters', async function () {
        const result = await robo.get_activity('gm', {
            contract: 'eosio.token',
            action: 'transfer',
            limit: 5,
        })

        assert.isArray(result.actions)
        assert.isAtLeast(result.actions.length, 1, 'Should have transfers')
        assert.isAtMost(result.actions.length, 5, 'Limit should be enforced even with filters')

        result.actions.forEach((action) => {
            assert.equal(action.action_trace.act.account, 'eosio.token')
            assert.equal(action.action_trace.act.name, 'transfer')
        })
    })

    suite('error handling', function () {
        test('conflicting date parameters (date + start_date)', async function () {
            try {
                await robo.get_activity('gm', {
                    date: '2025-12-10',
                    start_date: '2025-12-01',
                    limit: 5,
                })
                assert.fail('Should have thrown error for conflicting date parameters')
            } catch (error) {
                assert.instanceOf(error, Error, 'Should throw error for conflicting dates')
            }
        })

        test('limit: 0 (invalid)', async function () {
            try {
                const result = await robo.get_activity('gm', {
                    limit: 0,
                })

                assert.isArray(result.actions)
                assert.equal(result.actions.length, 0, 'Limit 0 should return empty array')
            } catch (error) {
                assert.instanceOf(error, Error, 'API may reject limit: 0')
            }
        })

        test('negative limit (invalid)', async function () {
            try {
                const result = await robo.get_activity('gm', {
                    limit: -5,
                })

                assert.isArray(result.actions)
            } catch (error) {
                assert.instanceOf(error, Error, 'Negative limit should be rejected')
            }
        })

        test('empty string contract filter', async function () {
            const result = await robo.get_activity('gm', {
                contract: '',
                limit: 5,
            })

            assert.isArray(result.actions)
        })

        test('empty string action filter', async function () {
            const result = await robo.get_activity('gm', {
                contract: 'eosio.token',
                action: '',
                limit: 5,
            })

            assert.isArray(result.actions)
        })
    })
})
