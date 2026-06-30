import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";
import { CodingService } from "./coding.service";

@WebSocketGateway({ namespace: "coding", cors: { origin: process.env.FRONTEND_URL, credentials: true } })
export class CodingGateway {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly coding: CodingService) {}

  @SubscribeMessage("room:join")
  join(@MessageBody() body: { roomId: string }) {
    return { event: "room:joined", data: body };
  }

  @SubscribeMessage("code:update")
  async update(@MessageBody() body: { roomId: string; code: string }) {
    await this.coding.updateCode(body.roomId, body.code);
    this.server.to(body.roomId).emit("code:updated", body);
    return { event: "code:saved", data: { roomId: body.roomId } };
  }

  @SubscribeMessage("chat:send")
  chat(@MessageBody() body: { roomId: string; message: string; author: string }) {
    this.server.to(body.roomId).emit("chat:message", { ...body, sentAt: new Date().toISOString() });
  }
}
