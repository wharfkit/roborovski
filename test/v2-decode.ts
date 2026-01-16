import {assert} from 'chai'

import {
    createTestClient,
    TEST_ACCOUNT,
    TEST_ACTION_TRANSFER,
    TEST_CONTRACT_TOKEN,
} from './v2-helpers'

const robo = createTestClient()

suite('v2 - decode parameter', function () {
    this.slow(200)
    this.timeout(10 * 1000)

    suite('baseline', function () {
        test('decode: true (default)', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: TEST_ACTION_TRANSFER,
                limit: 1,
            })

            assert.isArray(result.results)
            assert.isAtLeast(result.results.length, 1)

            const action = result.results[0]
            const data = action.action_trace.act.data

            assert.property(data, 'from', 'Decoded transfer should have "from" field')
            assert.property(data, 'to', 'Decoded transfer should have "to" field')
            assert.property(data, 'quantity', 'Decoded transfer should have "quantity" field')
            assert.property(data, 'memo', 'Decoded transfer should have "memo" field')

            assert.isString(
                action.action_trace.act.hex_data,
                'hex_data should be present when decode: true'
            )
            assert.match(
                action.action_trace.act.hex_data as string,
                /^[0-9a-fA-F]+$/,
                'hex_data should be valid hex'
            )
        })

        test('decode: false', async function () {
            const result = await robo.activity(TEST_ACCOUNT, {
                contract: TEST_CONTRACT_TOKEN,
                action: TEST_ACTION_TRANSFER,
                decode: false,
                limit: 1,
            })

            assert.isArray(result.results)
            assert.isAtLeast(result.results.length, 1)

            const action = result.results[0]
            const data = action.action_trace.act.data

            assert.isString(data, 'With decode: false, data should be hex string')
            assert.match(data as string, /^[0-9a-fA-F]+$/, 'Data should be valid hex')
        })
    })
})
