import { BigDecimal, Counter, Gauge, scaleDown } from "@sentio/sdk"
import {
    TransferEvent,
    SimpleTokenContext,
    SimpleTokenProcessor,
} from "./types/eth/simpletoken.js"
import { token } from "@sentio/sdk/utils"
import {
    RESOLV_DECIMALS,
    RESOLV_DEPLOY_BLOCK,
    RESOLV_PROXY,
    SUPERFORM_ROUTER,
} from "./constants.js"
import { User } from "./schema/store.js"
import { superformrouter, SuperformRouterProcessor } from "./types/eth/index.js"
import { address } from "@sentio/sdk/sui/builtin/0x1"
import { event } from "@sentio/sdk/aptos/builtin/0x1"
import {
    CompletedEvent,
    SingleDirectSingleVaultDepositCallObject,
    SuperformRouterContext,
} from "./types/eth/superformrouter.js"

const transferEventHandler = async function (
    event: TransferEvent,
    ctx: SimpleTokenContext
) {
    const tokenInfo = await token.getERC20TokenInfo(ctx, ctx.address)
    const senderAmount = scaleDown(
        await ctx.contract.balanceOf(event.args.from),
        tokenInfo.decimal
    )
    const receiverAmount = scaleDown(
        await ctx.contract.balanceOf(event.args.to),
        tokenInfo.decimal
    )

    const fromStore = ctx.store.get(User, event.args.from)
    const toStore = ctx.store.get(User, event.args.to)

    if (senderAmount != BigDecimal(0)) {
        const from = new User({
            id: event.args.from,
            balance: senderAmount,
        })

        await ctx.store.upsert(from)
    }
    if (receiverAmount != BigDecimal(0)) {
        const to = new User({
            id: event.args.to,
            balance: receiverAmount,
        })

        await ctx.store.upsert(to)
    }
}
const singleDirectVaultDepositHandler = async function (
    event: superformrouter.SingleDirectSingleVaultDepositCallTrace,
    ctx: SuperformRouterContext
) {
    const liqRequest = event.args.req_.superformData.liqRequest.token
    if (liqRequest == RESOLV_PROXY) {
        ctx.eventLogger.emit("deposit", {
            distinctId: String(event.args.req_.superformData.superformId),
            liqreq: liqRequest,
            amount: scaleDown(
                event.args.req_.superformData.amount,
                RESOLV_DECIMALS
            ),
            from: event.args.req_.superformData.receiverAddress,
        })
    }
}

SimpleTokenProcessor.bind({
    address: RESOLV_PROXY,
    startBlock: RESOLV_DEPLOY_BLOCK,
}).onEventTransfer(transferEventHandler)

SuperformRouterProcessor.bind({
    address: SUPERFORM_ROUTER,
    startBlock: RESOLV_DEPLOY_BLOCK,
}).onCallSingleDirectSingleVaultDeposit(singleDirectVaultDepositHandler)
