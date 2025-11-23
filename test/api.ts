import {assert} from 'chai'

import {APIClient, FetchProvider} from '@wharfkit/antelope'
import {mockFetch} from '@wharfkit/mock-data'

import {RoborovskiClient} from '$lib'

// Setup an APIClient using mockFetch for recording/playback
const client = new APIClient({
    provider: new FetchProvider('https://jungle4.greymass.com', {fetch: mockFetch}),
})

// Setup the API
const robo = new RoborovskiClient(client)

// Setup for unix socket tests (only if MOCK_SOCKET is set)
const SOCKET_PATH = process.env['MOCK_SOCKET']
const socketClient = SOCKET_PATH
    ? new APIClient({
          provider: new FetchProvider('http://localhost', {fetch: mockFetch}),
      })
    : null
const roboSocket = socketClient ? new RoborovskiClient(socketClient) : null

suite('api', function () {
    this.slow(200)
    this.timeout(10 * 10000)

    test('get_transaction (default, no traces)', async function () {
        const res = await robo.get_transaction(
            '9113c9a11795f683fd10ee918737d177a499054cc019043700183960132ae182'
        )
        assert.isTrue(
            res.id.equals('9113c9a11795f683fd10ee918737d177a499054cc019043700183960132ae182')
        )
        assert.equal(res.traces, null)
    })

    test('get_transaction (with traces)', async function () {
        const res = await robo.get_transaction(
            '9113c9a11795f683fd10ee918737d177a499054cc019043700183960132ae182',
            {traces: true}
        )
        assert.isTrue(
            res.id.equals('9113c9a11795f683fd10ee918737d177a499054cc019043700183960132ae182')
        )
        assert.isDefined(res.traces)
        assert.lengthOf(res.traces, 1)
    })

    test('get_actions (default, most recent)', async function () {
        const res = await robo.get_actions('teamgreymass')
        const test = res.actions.map((a) => Number(a.account_action_seq))
        assert.equal(test[0], 907)
        assert.equal(test[9], 898)
    })

    test('get_actions (first 10)', async function () {
        const res = await robo.get_actions('teamgreymass', {
            start: 0,
            limit: 10,
        })
        const test = res.actions.map((a) => Number(a.account_action_seq))
        assert.equal(test[0], 0)
        assert.equal(test[9], 9)
    })

    test('get_actions (second 10)', async function () {
        const res = await robo.get_actions('teamgreymass', {
            start: 11,
            limit: 10,
        })
        const test = res.actions.map((a) => Number(a.account_action_seq))
        assert.equal(test[0], 11)
        assert.equal(test[9], 20)
    })

    test('get_actions (last 10)', async function () {
        const res = await robo.get_actions('teamgreymass', {
            start: 1,
            limit: 10,
            reverse: true,
        })
        const test = res.actions.map((a) => Number(a.account_action_seq))
        assert.equal(test[0], 907)
        assert.equal(test[9], 898)
    })
})

// Tests against local unix socket running accountfilter service
// To run these tests:
// 1. Start the roborovski services in /Users/aaron/projects/roborovski:
//    cd /Users/aaron/projects/roborovski
//    ./scripts/start-historydata.sh
//    ./scripts/start-accountfilter.sh
// 2. Run tests with MOCK_SOCKET environment variable:
//    MOCK_SOCKET=/Users/aaron/projects/roborovski/testing/tmp/accountfilter.sock make test
suite('accountfilter (unix socket)', function () {
    this.slow(500)
    this.timeout(10 * 1000)

    // Skip all tests if MOCK_SOCKET is not set
    setup(function () {
        if (!roboSocket) {
            this.skip()
        }
    })

    test('socket connection test', async function () {
        // Basic connectivity test - verify socket is responding
        const res = await roboSocket!.get_actions('eosio', {limit: 5})
        assert.isDefined(res)
        assert.isArray(res.actions)
        // Socket is working if we get a response (even if empty)
    })

    test('get_actions (filter by contract only)', async function () {
        const res = await roboSocket!.get_actions('teamgreymass', {
            contract: 'eosio.token',
            limit: 10,
        })
        assert.isDefined(res)
        assert.isArray(res.actions)

        // Verify all actions are from the specified contract
        res.actions.forEach((action) => {
            const act = action.action_trace.act
            assert.equal(String(act.account), 'eosio.token')
        })
    })

    test('get_actions (filter by action only)', async function () {
        const res = await roboSocket!.get_actions('teamgreymass', {
            action: 'transfer',
            limit: 10,
        })
        assert.isDefined(res)
        assert.isArray(res.actions)

        // Verify all actions have the specified action name
        res.actions.forEach((action) => {
            const act = action.action_trace.act
            assert.equal(String(act.name), 'transfer')
        })
    })

    test('get_actions (filter by contract and action)', async function () {
        const res = await roboSocket!.get_actions('teamgreymass', {
            contract: 'eosio.token',
            action: 'transfer',
            limit: 10,
        })
        assert.isDefined(res)
        assert.isArray(res.actions)

        // Verify all actions match both contract and action filters
        res.actions.forEach((action) => {
            const act = action.action_trace.act
            assert.equal(String(act.account), 'eosio.token')
            assert.equal(String(act.name), 'transfer')
        })
    })

    test('get_actions (filter by contract with pagination)', async function () {
        const res = await roboSocket!.get_actions('eosio', {
            contract: 'eosio',
            start: 0,
            limit: 5,
        })
        assert.isDefined(res)
        assert.isArray(res.actions)
        assert.isAtMost(res.actions.length, 5)

        // Verify all actions are from the specified contract
        res.actions.forEach((action) => {
            const act = action.action_trace.act
            assert.equal(String(act.account), 'eosio')
        })
    })

    test('get_actions (filter with reverse order)', async function () {
        const res = await roboSocket!.get_actions('eosio', {
            contract: 'eosio.token',
            limit: 10,
            reverse: true,
        })
        assert.isDefined(res)
        assert.isArray(res.actions)

        if (res.actions.length > 1) {
            // Verify actions are in descending order by account_action_seq
            const seqs = res.actions.map((a) => Number(a.account_action_seq))
            for (let i = 1; i < seqs.length; i++) {
                assert.isTrue(seqs[i] < seqs[i - 1], 'Actions should be in descending order')
            }
        }

        // Verify all actions are from the specified contract
        res.actions.forEach((action) => {
            const act = action.action_trace.act
            assert.equal(String(act.account), 'eosio.token')
        })
    })

    test('get_actions (verify action structure)', async function () {
        const res = await roboSocket!.get_actions('eosio', {
            contract: 'eosio',
            action: 'newaccount',
            limit: 1,
        })
        assert.isDefined(res)
        assert.isArray(res.actions)

        if (res.actions.length > 0) {
            const action = res.actions[0]
            assert.isDefined(action.global_action_seq)
            assert.isDefined(action.account_action_seq)
            assert.isDefined(action.block_num)
            assert.isDefined(action.block_time)
            assert.isDefined(action.action_trace)
            assert.isDefined(action.action_trace.act)
            assert.isDefined(action.action_trace.act.account)
            assert.isDefined(action.action_trace.act.name)
        }
    })
})
