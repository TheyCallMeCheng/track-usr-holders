import { BigDecimal, Counter, Gauge, scaleDown } from "@sentio/sdk"
import {
    TransferEvent,
    SimpleTokenContext,
    SimpleTokenProcessor,
} from "./types/eth/simpletoken.js"
import { token } from "@sentio/sdk/utils"
import { RESOLV_PROXY } from "./constants.js"
import { User } from "./schema/store.js"

const tokenCounter = Counter.register("token")
const startBlock = 20005922
// const transfer = Gauge.register("transfer")
// const transferAcc = Counter.register("transfer_acc")
const holderAmount = Gauge.register("holderAmount")
// const holders = Counter.register("holders")

const transferEventHandler = async function (
    event: TransferEvent,
    ctx: SimpleTokenContext
) {
    const tokenInfo = await token.getERC20TokenInfo(ctx, ctx.address)
    // const amount = event.args.value.scaleDown(tokenInfo.decimal)
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

SimpleTokenProcessor.bind({
    address: RESOLV_PROXY,
    // startBlock: startBlock,
}).onEventTransfer(transferEventHandler)
