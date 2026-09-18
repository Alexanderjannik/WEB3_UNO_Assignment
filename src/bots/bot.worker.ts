import { chooseAction, type BotRequest, type BotResponse } from './bot'

//#region Messages

self.onmessage = (event: MessageEvent<BotRequest>) =>
{
  const response: BotResponse = {
    id: event.data.id,
    action: chooseAction(event.data.state)
  }

  self.postMessage(response)
}

//#endregion
