# @wharfkit/roborovski

API client for the Roborovski API.

## Installing

```
yarn add @wharfkit/roborovski
```

## Usage

```typescript
import {APIClient} from '@wharfkit/antelope'
import {RoborovskiClient} from '@wharfkit/roborovski'

// Create an API client
const client = new APIClient({url: 'https://jungle4.greymass.com'})

// Create a Roborovski client
const robo = new RoborovskiClient(client)

// Get actions for an account
const actions = await robo.get_actions('teamgreymass')

// Get filtered actions (by contract and/or action)
const filtered = await robo.get_filtered_actions('teamgreymass', {
    contract: 'eosio.token',
    action: 'transfer',
    limit: 20,
})

// Get transaction details
const tx = await robo.get_transaction(
    '9113c9a11795f683fd10ee918737d177a499054cc019043700183960132ae182',
    {traces: true}
)
```

## API Methods

### `get_actions(accountName, options?)`

Retrieves actions for a specific account.

**Options:**
- `start?: number` - Starting position (default: -1 for most recent)
- `limit?: number` - Number of actions to retrieve (default: 100)
- `reverse?: boolean` - Return actions in reverse order (default: true)

### `get_filtered_actions(accountName, options?)`

Retrieves filtered actions for a specific account. This endpoint is optimized for querying actions by contract and/or action name.

**Options:**
- `contract?: string` - Filter by contract account name
- `action?: string` - Filter by action name
- `start?: number` - Starting position (default: -1 for most recent)
- `limit?: number` - Number of actions to retrieve (default: 20)
- `reverse?: boolean` - Return actions in reverse order (default: true)

**Note:** When both `contract` and `action` filters are specified, the query uses optimized indexes for significantly faster results.

### `get_transaction(id, options?)`

Retrieves transaction details by transaction ID.

**Options:**
- `blockNumHint?: number` - Optional block number hint for faster lookup
- `traces?: boolean` - Include execution traces (default: false)

## Running Tests

```
make test
```
