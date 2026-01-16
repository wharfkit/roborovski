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
 * Options for querying account activity (v2)
 */
export interface ActivityOptions {
    /** Number of actions to retrieve per page (default: 100) */
    limit?: number
    /** Sort order by sequence number: "asc" or "desc" (default) */
    order?: 'asc' | 'desc'
    /** Pagination cursor from previous response */
    cursor?: string
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
 * Parameters sent to the activity API (query/body params, not including path param)
 */
interface ActivityParams extends ActivityOptions {
    limit: number
    order: 'asc' | 'desc'
    decode: boolean
}

/**
 * Options for querying transactions (v2)
 */
export interface TransactionOptions {
    /** Include action traces in response (default: true) */
    traces?: boolean
}

/**
 * Options for querying transactions (legacy v1)
 */
export interface GetTransactionOptions {
    /** Block number hint for faster lookup */
    blockNumHint?: UInt32Type
    /** Include action traces in response */
    traces?: boolean
}

/**
 * Raw response from activity API (v2)
 */
interface ActivityAPIResponse {
    results: API.v1.OrderedActionsResult[]
    next_cursor?: string
    prev_cursor?: string
}

/**
 * Cursor for paginating through account activity results.
 * Returned by RoborovskiClient.activity()
 */
export class ActivityCursor {
    readonly results: API.v1.OrderedActionsResult[]
    readonly next_cursor?: string
    readonly prev_cursor?: string

    private readonly client: APIClient
    private readonly account: Name
    private readonly options: ActivityOptions

    constructor(
        client: APIClient,
        account: Name,
        options: ActivityOptions,
        response: ActivityAPIResponse
    ) {
        this.client = client
        this.account = account
        this.options = options
        this.results = response.results
        this.next_cursor = response.next_cursor
        this.prev_cursor = response.prev_cursor
    }

    async next(): Promise<ActivityCursor> {
        if (!this.next_cursor) {
            throw new Error('No next page available')
        }
        return ActivityCursor.fetch(this.client, this.account, {
            ...this.options,
            cursor: this.next_cursor,
        })
    }

    async prev(): Promise<ActivityCursor> {
        if (!this.prev_cursor) {
            throw new Error('No previous page available')
        }
        return ActivityCursor.fetch(this.client, this.account, {
            ...this.options,
            cursor: this.prev_cursor,
        })
    }

    static async fetch(
        client: APIClient,
        account: Name,
        options: ActivityOptions = {}
    ): Promise<ActivityCursor> {
        if (options.action && !options.contract) {
            throw new Error('action filter requires contract to be specified')
        }

        const params: ActivityParams = {
            limit: options.limit !== undefined ? options.limit : 100,
            order: options.order || 'desc',
            decode: options.decode !== undefined ? options.decode : true,
            cursor: options.cursor,
            contract: options.contract,
            action: options.action,
            date: options.date,
            start_date: options.start_date,
            end_date: options.end_date,
            omit_null_fields: options.omit_null_fields,
        }

        const response = (await client.call({
            path: `/account/${account}/activity`,
            params,
        })) as ActivityAPIResponse

        return new ActivityCursor(client, account, options, response)
    }
}

/**
 * Response type for transaction API (v2)
 */
export interface TransactionResponse {
    /** Transaction ID */
    id: string
    /** Block number containing the transaction */
    block_num: number
    /** Block timestamp */
    block_time: string
    /** Current head block number */
    head_block_num: number
    /** Last irreversible block number */
    last_irreversible_block: number
    /** Whether the transaction is irreversible */
    irreversible: boolean
    /** Transaction position within the block */
    transaction_num: number
    /** Action traces (null if not requested) */
    traces: unknown[] | null
    /** Transaction receipt and body */
    trx: unknown
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
        let reverse = options ? options.reverse : undefined

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
     * Query account activity (v2)
     * Returns a cursor for paginating through results
     *
     * @param accountName - Account to query
     * @param options - Query options
     * @returns ActivityCursor with results and pagination methods
     * @throws {Error} If action is specified without contract
     */
    async activity(accountName: NameType, options?: ActivityOptions): Promise<ActivityCursor> {
        return ActivityCursor.fetch(this.client, Name.from(accountName), options)
    }

    /**
     * Get transaction by ID (v2)
     *
     * @param id - Transaction ID
     * @param options - Query options
     */
    async transaction(
        id: Checksum256Type,
        options: TransactionOptions = {}
    ): Promise<TransactionResponse> {
        const txid = Checksum256.from(id)
        const response = (await this.client.call({
            path: `/transaction/${txid}`,
            params: {
                traces: options.traces !== undefined ? options.traces : true,
            },
        })) as {results: TransactionResponse}
        return response.results
    }

    /**
     * Get transaction by ID (legacy v1)
     *
     * @param id - Transaction ID
     * @param options - Query options
     */
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
