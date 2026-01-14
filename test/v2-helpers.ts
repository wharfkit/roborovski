import {assert} from 'chai'
import {APIClient, FetchProvider} from '@wharfkit/antelope'
import {mockFetch} from '@wharfkit/mock-data'
import {RoborovskiClient, ActivityCursor} from '$lib'

/**
 * Shared test constants
 */
export const TEST_ACCOUNT = 'gm'
export const TEST_CONTRACT_TOKEN = 'eosio.token'
export const TEST_CONTRACT_SYSTEM = 'eosio'
export const TEST_CONTRACT_VAULTA = 'core.vaulta'
export const TEST_ACTION_TRANSFER = 'transfer'
export const TEST_DATE_RECENT = '2025-12-10'

/**
 * Create a RoborovskiClient for testing
 */
export function createTestClient(): RoborovskiClient {
    const client = new APIClient({
        provider: new FetchProvider('https://jungle4.roborovski.io', {fetch: mockFetch}),
    })
    return new RoborovskiClient(client)
}

/**
 * Validation: All actions are from specified contract
 */
export function validateContract(actions: any[], expectedContract: string): void {
    assert.isArray(actions, 'Actions should be an array')
    assert.isAbove(actions.length, 0, 'Should have at least one action')

    actions.forEach((action, index) => {
        assert.equal(
            action.action_trace.act.account,
            expectedContract,
            `Action ${index} should be from contract ${expectedContract}`
        )
    })
}

/**
 * Validation: All actions have specified action name
 */
export function validateAction(actions: any[], expectedAction: string): void {
    assert.isArray(actions, 'Actions should be an array')
    assert.isAbove(actions.length, 0, 'Should have at least one action')

    actions.forEach((action, index) => {
        assert.equal(
            action.action_trace.act.name,
            expectedAction,
            `Action ${index} should have name ${expectedAction}`
        )
    })
}

/**
 * Validation: All actions are within date range (inclusive)
 */
export function validateDateRange(actions: any[], start_date: string, end_date: string): void {
    assert.isArray(actions, 'Actions should be an array')
    assert.isAbove(actions.length, 0, 'Should have at least one action')

    actions.forEach((action, index) => {
        const blockTimeStr = String(action.block_time)
        const blockDate = blockTimeStr.split('T')[0]

        assert.isTrue(
            blockDate >= start_date && blockDate <= end_date,
            `Action ${index} date ${blockDate} should be between ${start_date} and ${end_date}`
        )
    })
}

/**
 * Validation: All actions are from a specific date
 */
export function validateDate(actions: any[], expectedDate: string): void {
    assert.isArray(actions, 'Actions should be an array')
    assert.isAbove(actions.length, 0, 'Should have at least one action')

    actions.forEach((action, index) => {
        const blockTimeStr = String(action.block_time)
        const blockDate = blockTimeStr.split('T')[0]
        assert.equal(blockDate, expectedDate, `Action ${index} should be from date ${expectedDate}`)
    })
}

/**
 * Validation: All global_action_seq values are unique
 */
export function validateUniqueGlobalSeqs(actions: any[]): void {
    assert.isArray(actions, 'Actions should be an array')

    if (actions.length === 0) {
        return // Empty results are valid
    }

    const seqs = actions.map((a) => Number(a.global_action_seq))
    const uniqueSeqs = new Set(seqs)

    assert.equal(seqs.length, uniqueSeqs.size, 'All global_action_seq values should be unique')
}

/**
 * Validation: No duplicate global_action_seq between two result sets
 */
export function validateNoDuplicatesBetweenPages(page1: any[], page2: any[]): void {
    const seqs1 = new Set(page1.map((a) => Number(a.global_action_seq)))
    const seqs2 = page2.map((a) => Number(a.global_action_seq))

    seqs2.forEach((seq) => {
        assert.isFalse(seqs1.has(seq), `Global sequence ${seq} should not appear in both pages`)
    })
}

/**
 * Validation: Actions have decoded data (when decode=true)
 */
export function validateDecoded(action: any, actionType?: string): void {
    assert.isObject(action.action_trace.act.data, 'Action data should be object when decoded')
    assert.isString(action.action_trace.act.hex_data, 'hex_data should always be present')

    // Validate structure for known action types
    if (actionType === 'transfer') {
        assert.property(action.action_trace.act.data, 'from', 'Transfer should have from')
        assert.property(action.action_trace.act.data, 'to', 'Transfer should have to')
        assert.property(action.action_trace.act.data, 'quantity', 'Transfer should have quantity')
        assert.property(action.action_trace.act.data, 'memo', 'Transfer should have memo')
    }
}

/**
 * Validation: Actions have hex data (when decode=false or no ABI)
 */
export function validateHexData(action: any): void {
    assert.isString(
        action.action_trace.act.data,
        'Action data should be hex string when not decoded'
    )
}

/**
 * Validation: Results are in ascending order by account_action_seq
 */
export function validateAscendingOrder(actions: any[]): void {
    assert.isArray(actions, 'Actions should be an array')

    if (actions.length <= 1) {
        return // Single or no results are trivially sorted
    }

    for (let i = 1; i < actions.length; i++) {
        const prevSeq = Number(actions[i - 1].account_action_seq)
        const currSeq = Number(actions[i].account_action_seq)

        assert.isBelow(
            prevSeq,
            currSeq,
            `Action at index ${
                i - 1
            } (seq ${prevSeq}) should be before action at index ${i} (seq ${currSeq})`
        )
    }
}

/**
 * Validation: Results are in descending order by account_action_seq
 */
export function validateDescendingOrder(actions: any[]): void {
    assert.isArray(actions, 'Actions should be an array')

    if (actions.length <= 1) {
        return // Single or no results are trivially sorted
    }

    for (let i = 1; i < actions.length; i++) {
        const prevSeq = Number(actions[i - 1].account_action_seq)
        const currSeq = Number(actions[i].account_action_seq)

        assert.isAbove(
            prevSeq,
            currSeq,
            `Action at index ${
                i - 1
            } (seq ${prevSeq}) should be after action at index ${i} (seq ${currSeq})`
        )
    }
}

/**
 * Helper: Paginate through all results
 */
export async function paginateAll(
    robo: RoborovskiClient,
    account: string,
    options: any
): Promise<any[]> {
    const allActions: any[] = []
    let cursor: ActivityCursor = await robo.activity(account, options)

    allActions.push(...cursor.results)

    while (cursor.next_cursor) {
        cursor = await cursor.next()
        allActions.push(...cursor.results)

        if (allActions.length > 10000) {
            throw new Error('Pagination exceeded 10000 actions - possible infinite loop')
        }
    }

    return allActions
}

/**
 * Helper: Get count of actions matching criteria
 */
export async function getActionCount(
    robo: RoborovskiClient,
    account: string,
    options: any
): Promise<number> {
    const allActions = await paginateAll(robo, account, options)
    return allActions.length
}
