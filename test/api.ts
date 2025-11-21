import {assert} from 'chai'

import {APIClient, FetchProvider} from '@wharfkit/antelope'
import {mockFetch} from '@wharfkit/mock-data'

import {RoborovskiClient} from '$lib'

// Setup an APIClient
const client = new APIClient({
    provider: new FetchProvider('https://jungle4.greymass.com', {fetch: mockFetch}),
})

// Setup the API
const robo = new RoborovskiClient(client)

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

    test('get_filtered_actions (default, most recent)', async function () {
        const res = await robo.get_filtered_actions('teamgreymass')
        assert.isArray(res.actions)
        assert.isTrue(res.actions.length <= 20) // Default limit is 20
    })

    test('get_filtered_actions (filter by contract)', async function () {
        const res = await robo.get_filtered_actions('teamgreymass', {
            contract: 'eosio.token',
            limit: 10,
        })
        assert.isArray(res.actions)
        // Verify all actions are from the specified contract
        res.actions.forEach((action) => {
            const act = action.action_trace.act
            assert.equal(act.account, 'eosio.token')
        })
    })

    test('get_filtered_actions (filter by action)', async function () {
        const res = await robo.get_filtered_actions('teamgreymass', {
            action: 'transfer',
            limit: 10,
        })
        assert.isArray(res.actions)
        // Verify all actions have the specified action name
        res.actions.forEach((action) => {
            const act = action.action_trace.act
            assert.equal(act.name, 'transfer')
        })
    })

    test('get_filtered_actions (filter by contract and action)', async function () {
        const res = await robo.get_filtered_actions('teamgreymass', {
            contract: 'eosio.token',
            action: 'transfer',
            limit: 10,
        })
        assert.isArray(res.actions)
        // Verify all actions match both contract and action filters
        res.actions.forEach((action) => {
            const act = action.action_trace.act
            assert.equal(act.account, 'eosio.token')
            assert.equal(act.name, 'transfer')
        })
    })

    test('get_filtered_actions (with custom pagination)', async function () {
        const res = await robo.get_filtered_actions('teamgreymass', {
            start: 0,
            limit: 5,
        })
        assert.isArray(res.actions)
        assert.isTrue(res.actions.length <= 5)
    })

    test('get_filtered_actions (reverse order)', async function () {
        const res = await robo.get_filtered_actions('teamgreymass', {
            contract: 'eosio.token',
            limit: 10,
            reverse: true,
        })
        assert.isArray(res.actions)
        // Verify actions are in descending order
        if (res.actions.length > 1) {
            const seqs = res.actions.map((a) => Number(a.account_action_seq))
            for (let i = 1; i < seqs.length; i++) {
                assert.isTrue(seqs[i] < seqs[i - 1])
            }
        }
    })
})
