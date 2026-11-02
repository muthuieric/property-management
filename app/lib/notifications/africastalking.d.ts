declare module 'africastalking' {
  interface AfricasTalkingOptions {
    apiKey: string
    username: string
  }
  interface SMSService {
    send(options: {
      to: string[]
      message: string
      from?: string
    }): Promise<any>
  }
  interface AfricasTalking {
    SMS: SMSService
  }
  declare function AfricasTalking(options: AfricasTalkingOptions): AfricasTalking
  export = AfricasTalking
}
