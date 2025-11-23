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

export interface GetActionOptions {
    contract?: NameType
    action?: NameType
    start?: Int32Type
    limit?: Int32Type
    reverse?: boolean
}

export class RoborovskiClient {
    constructor(private client: APIClient) {}

    async get_actions(accountName: NameType, options?: GetActionOptions) {
        let reverse = options?.reverse

        const params: Record<string, any> = {
            account_name: Name.from(accountName),
        }

        // Add optional contract filter
        if (options?.contract !== undefined) {
            params['contract'] = Name.from(options.contract)
        }

        // Add optional action filter
        if (options?.action !== undefined) {
            params['action'] = Name.from(options.action)
        }

        if (options) {
            if (options.start !== undefined) {
                params['pos'] = Int32.from(options.start)
            }
            if (options.limit) {
                params['offset'] = Int32.from(options.limit)
            }
            if (options.reverse && params['pos']) {
                params['pos'] *= -1
            }
            if (options.reverse && params['offset']) {
                params['offset'] *= -1
            }
        } else {
            // Default to most recent 100 actions reversed
            params['pos'] = Int32.from(-1)
            params['offset'] = Int32.from(-100)
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

    async get_transaction(
        id: Checksum256Type,
        options: {blockNumHint?: UInt32Type; traces?: boolean} = {}
    ) {
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
