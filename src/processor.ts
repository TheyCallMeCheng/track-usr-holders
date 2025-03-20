import { BigDecimal, LogLevel, scaleDown } from "@sentio/sdk"
import { TransferEvent, SimpleTokenContext, SimpleTokenProcessor } from "./types/eth/simpletoken.js"
import { token } from "@sentio/sdk/utils"
import { RESOLV_DECIMALS, RESOLV_DEPLOY_BLOCK, RESOLV_PROXY, SUPERFORM_ROUTER } from "./constants.js"
import { User } from "./schema/store.js"
import { superformrouter, SuperformRouterProcessor } from "./types/eth/index.js"
import { event } from "@sentio/sdk/aptos/builtin/0x1"
import { SuperformRouterContext } from "./types/eth/superformrouter.js"

const transferEventHandler = async function (event: TransferEvent, ctx: SimpleTokenContext) {
    const tokenInfo = await token.getERC20TokenInfo(ctx, ctx.address)
    const senderAmount = scaleDown(await ctx.contract.balanceOf(event.args.from), tokenInfo.decimal)
    const receiverAmount = scaleDown(await ctx.contract.balanceOf(event.args.to), tokenInfo.decimal)

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
    try {
        const liqRequest = event.args.req_.superformData.liqRequest.token
        if (liqRequest == RESOLV_PROXY) {
            ctx.eventLogger.emit("deposit", {
                distinctID: event.args.req_.superformData.receiverAddress,
                poolID: String(event.args.req_.superformData.superformId),
                amount: scaleDown(event.args.req_.superformData.amount, RESOLV_DECIMALS),
                message:
                    "Superform deposit " +
                    scaleDown(event.args.req_.superformData.amount, RESOLV_DECIMALS) +
                    " RESOLV to pool " +
                    event.args.req_.superformData.superformId +
                    " from " +
                    event.args.req_.superformData.receiverAddress,
            })
        }
    } catch (e) {
        ctx.eventLogger.emit("error", {
            message: e.message,
            stack: e.stack,
            block: event.blockNumber,
            hash: event.transactionHash,
            severity: LogLevel.ERROR,
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
