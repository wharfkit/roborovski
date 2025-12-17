import {
    API,
    APIClient,
    Checksum256,
    Checksum256Type,
    Int32,
    Int32Type,
    Name,
    NameType,
    UInt32,
    UInt32Type,
} from '@wharfkit/antelope'

/**
 * Options for querying account actions
 */
export interface GetActionOptions {
    /** Starting position (default: -1 for latest) */
    start?: Int32Type
    /** Number of actions to retrieve */
    limit?: Int32Type
    /** Reverse the order of results */
    reverse?: boolean
}

/**
 * Options for querying account activity
 */
export interface GetActivityOptions {
    // Pagination
    /** Number of actions to retrieve per page (default: 100) */
    limit?: number
    /** Sort order by sequence number: "asc" or "desc" (default) */
    order?: 'asc' | 'desc'
    /** Pagination cursor from previous response */
    cursor?: string

    // Filters
    /** Filter by contract account */
    contract?: string
    /** Filter by action name (requires contract) */
    action?: string
    /** Filter by single date YYYY-MM-DD */
    date?: string
    /** Filter by date range start YYYY-MM-DD */
    start_date?: string
    /** Filter by date range end YYYY-MM-DD */
    end_date?: string

    // Response formatting
    /** Enable ABI decoding of action data (default: true) */
    decode?: boolean
    /** Omit null fields from response (default: false) */
    omit_null_fields?: boolean
}

/**
 * Parameters sent to the get_actions API
 */
interface GetActionsParams {
    account_name: NameType
    pos?: Int32Type
    offset?: Int32Type
}

/**
 * Parameters sent to the get_activity API
 */
interface GetActivityParams extends GetActivityOptions {
    account_name: NameType
    limit: number
    order: 'asc' | 'desc'
    decode: boolean
}

/**
 * Options for querying transactions
 */
export interface GetTransactionOptions {
    /** Block number hint for faster lookup */
    blockNumHint?: UInt32Type
    /** Include action traces in response */
    traces?: boolean
}

/**
 * Response type for get_activity API
 */
export interface GetActivityResponse {
    /** Array of action traces */
    actions: API.v1.OrderedActionsResult[]
    /** Pagination information */
    pagination: {
        /** Cursor for next page (absent on last page) */
        next_cursor?: string
        /** Cursor for previous page (only present on pages after first) */
        prev_cursor?: string
    }
    /** Last irreversible block number */
    last_irreversible_block: number
}

export class RoborovskiClient {
    constructor(private client: APIClient) {}

    /**
     * Query account actions
     * Uses pos/offset parameters with negation for reverse
     */
    async get_actions(
        accountName: NameType,
        options?: GetActionOptions
    ): Promise<API.v1.GetActionsResponse> {
        let reverse = options?.reverse

        const params: GetActionsParams = {
            account_name: Name.from(accountName),
        }

        if (options) {
            if (options.start !== undefined) {
                params.pos = Int32.from(options.start)
            }
            if (options.limit) {
                params.offset = Int32.from(options.limit)
            }
            if (options.reverse && params.pos) {
                params.pos = Int32.from(params.pos).multiplying(-1)
            }
            if (options.reverse && params.offset) {
                params.offset = Int32.from(params.offset).multiplying(-1)
            }
        } else {
            params.pos = Int32.from(-1)
            params.offset = Int32.from(-100)
            reverse = true
        }

        const result = await this.client.call({
            path: '/v1/history/get_actions',
            params,
            responseType: API.v1.GetActionsResponse,
        })

        if (reverse) {
            result.actions.reverse()
        }

        return result
    }

    /**
     * Query account activity
     * Supports filtering, pagination, and explicit ordering
     *
     * @param accountName - Account to query
     * @param options - Query options
     * @throws {Error} If action is specified without contract
     */
    async get_activity(
        accountName: NameType,
        options?: GetActivityOptions
    ): Promise<GetActivityResponse> {
        // Runtime validation: action requires contract
        if (options?.action && !options?.contract) {
            throw new Error('action filter requires contract to be specified')
        }

        const params: GetActivityParams = {
            account_name: Name.from(accountName),
            limit: options?.limit ?? 100,
            order: options?.order ?? 'desc',
            decode: options?.decode ?? true,
            cursor: options?.cursor,
            contract: options?.contract,
            action: options?.action,
            date: options?.date,
            start_date: options?.start_date,
            end_date: options?.end_date,
            omit_null_fields: options?.omit_null_fields,
        }

        const result = (await this.client.call({
            path: '/v1/history/get_activity',
            params,
        })) as GetActivityResponse

        return result
    }

    async get_transaction(id: Checksum256Type, options: GetTransactionOptions = {}) {
        return this.client.call({
            path: '/v1/history/get_transaction',
            params: {
                id: Checksum256.from(id),
                block_num_hint: options.blockNumHint && UInt32.from(options.blockNumHint),
                traces: options.traces !== undefined ? options.traces : false,
            },
            responseType: API.v1.GetTransactionResponse,
        })
    }
}
