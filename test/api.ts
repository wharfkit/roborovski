import {assert} from 'chai'

import {APIClient, FetchProvider} from '@wharfkit/antelope'
import {mockFetch} from '@wharfkit/mock-data'

import {RoborovskiClient} from '$lib'

// Setup an APIClient with mockFetch for deterministic tests
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
})
