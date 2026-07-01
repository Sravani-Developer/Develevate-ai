import { CodingGateway } from "../src/modules/coding/coding.gateway";

describe("CodingGateway", () => {
  it("joins sockets to the requested coding room", () => {
    const gateway = new CodingGateway({} as never);
    const socket = { join: jest.fn() };

    const result = gateway.join({ roomId: "room-1" }, socket as never);

    expect(socket.join).toHaveBeenCalledWith("room-1");
    expect(result).toEqual({ event: "room:joined", data: { roomId: "room-1" } });
  });
});
