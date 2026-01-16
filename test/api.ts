import {assert} from 'chai'

import {APIClient, FetchProvider} from '@wharfkit/antelope'
import {mockFetch} from '@wharfkit/mock-data'

import {RoborovskiClient} from '$lib'

// Setup an APIClient with mockFetch for deterministic tests (legacy endpoint)
const legacyClient = new APIClient({
    provider: new FetchProvider('https://jungle4.greymass.com', {fetch: mockFetch}),
})
const legacyRobo = new RoborovskiClient(legacyClient)

// Setup an APIClient with mockFetch for new API endpoint
const newClient = new APIClient({
    provider: new FetchProvider('https://jungle4.roborovski.io', {fetch: mockFetch}),
})
const newRobo = new RoborovskiClient(newClient)

const TEST_TX_ID = '9113c9a11795f683fd10ee918737d177a499054cc019043700183960132ae182'

suite('api', function () {
    this.slow(200)
    this.timeout(10 * 10000)

    suite('legacy endpoint (jungle4.greymass.com)', function () {
        test('get_transaction (default, no traces)', async function () {
            const res = await legacyRobo.get_transaction(TEST_TX_ID)
            assert.isTrue(res.id.equals(TEST_TX_ID))
            assert.equal(res.traces, null)

            assert.equal(Number(res.block_num), 99840257)

            const trx = res.trx.trx
            assert.lengthOf(trx.actions, 1)
            assert.equal(String(trx.actions[0].account), 'eosio')
            assert.equal(String(trx.actions[0].name), 'setabi')
            assert.lengthOf(trx.actions[0].authorization, 1)
            assert.equal(String(trx.actions[0].authorization[0].actor), 'corecorecore')
            assert.equal(String(trx.actions[0].authorization[0].permission), 'active')

            const receipt = res.trx.receipt
            assert.equal(String(receipt.status), 'executed')
            assert.equal(Number(receipt.cpu_usage_us), 430)
            assert.equal(Number(receipt.net_usage_words), 22)
        })

        test('get_transaction (with traces)', async function () {
            const res = await legacyRobo.get_transaction(TEST_TX_ID, {traces: true})
            assert.isTrue(res.id.equals(TEST_TX_ID))
            assert.isDefined(res.traces)
            assert.lengthOf(res.traces!, 1)

            const json = res.toJSON()
            const trace = json.traces[0]
            assert.equal(trace.act.account, 'eosio')
            assert.equal(trace.act.name, 'setabi')
            assert.equal(trace.receiver, 'eosio')
            assert.equal(trace.action_ordinal, 1)
            assert.equal(trace.block_num, 99840257)
            assert.equal(trace.context_free, false)

            assert.lengthOf(trace.account_ram_deltas, 1)
            assert.equal(trace.account_ram_deltas[0].account, 'corecorecore')
            assert.equal(trace.account_ram_deltas[0].delta, 96)

            assert.equal(trace.trx_id, TEST_TX_ID)
            assert.equal(trace.receipt.global_sequence, 132670040)
        })
    })

    suite('new endpoint (jungle4.roborovski.io)', function () {
        test('transaction (default, with traces)', async function () {
            const res = await newRobo.transaction(TEST_TX_ID)
            assert.equal(res.id, TEST_TX_ID)
            assert.isDefined(res.traces)
            assert.lengthOf(res.traces!, 1)

            assert.equal(res.block_num, 99840257)

            const trx = res.trx as {trx: {actions: unknown[]}}
            assert.lengthOf(trx.trx.actions, 1)
            const action = trx.trx.actions[0] as {
                account: string
                name: string
                authorization: {actor: string; permission: string}[]
            }
            assert.equal(action.account, 'eosio')
            assert.equal(action.name, 'setabi')
            assert.lengthOf(action.authorization, 1)
            assert.equal(action.authorization[0].actor, 'corecorecore')
            assert.equal(action.authorization[0].permission, 'active')

            const receipt = (
                res.trx as unknown as {
                    receipt: {status: string; cpu_usage_us: number; net_usage_words: number}
                }
            ).receipt
            assert.equal(receipt.status, 'executed')
            assert.equal(receipt.cpu_usage_us, 430)
            assert.equal(receipt.net_usage_words, 22)
        })

        test('transaction (no traces)', async function () {
            const res = await newRobo.transaction(TEST_TX_ID, {traces: false})
            assert.equal(res.id, TEST_TX_ID)
            assert.isNull(res.traces)

            assert.equal(res.block_num, 99840257)
        })
    })

    suite('get_actions (legacy endpoint)', function () {
        test('get_actions (default, most recent)', async function () {
            const res = await legacyRobo.get_actions('teamgreymass')
            const test = res.actions.map((a) => Number(a.account_action_seq))
            assert.isAtLeast(test.length, 1, 'Should return actions')
            // Default is descending order (most recent first)
            for (let i = 1; i < test.length; i++) {
                assert.isAbove(test[i - 1], test[i], 'Actions should be in descending order')
            }
        })

        test('get_actions (first 10)', async function () {
            const res = await legacyRobo.get_actions('teamgreymass', {
                start: 0,
                limit: 10,
            })
            const test = res.actions.map((a) => Number(a.account_action_seq))
            assert.equal(test[0], 0)
            assert.equal(test[9], 9)
        })

        test('get_actions (second 10)', async function () {
            const res = await legacyRobo.get_actions('teamgreymass', {
                start: 11,
                limit: 10,
            })
            const test = res.actions.map((a) => Number(a.account_action_seq))
            assert.equal(test[0], 11)
            assert.equal(test[9], 20)
        })

        test('get_actions (last 10)', async function () {
            const res = await legacyRobo.get_actions('teamgreymass', {
                start: 1,
                limit: 10,
                reverse: true,
            })
            const test = res.actions.map((a) => Number(a.account_action_seq))
            assert.lengthOf(test, 10, 'Should return 10 actions')
            // Reverse flag returns most recent first
            for (let i = 1; i < test.length; i++) {
                assert.isAbove(test[i - 1], test[i], 'Actions should be in descending order')
            }
        })
    })
})
