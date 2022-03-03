#!/usr/bin/python3.10
import asyncio
import logging

import websockets

pause: bool = False
name: str = ""
clients = dict()
host: websockets.WebSocketServerProtocol = None


async def end():
    global pause, clients
    logger.info(f"Host {'(Unknown)' if host is None else host.remote_address} Issued Exit Command")
    pause = False
    with open("client.txt", "w") as client_file:
        client_file.write(f"0,0")
    for client in clients.values():
        logger.info(f"Sending Disconnect to {client.remote_address}")
        await client.send("d")
    clients = dict()


async def handler(websocket: websockets.WebSocketServerProtocol):
    global pause, host, name
    logger.info(f"{websocket.remote_address} is Trying to Connect")
    while True:
        try:
            try:
                in_stream = await websocket.recv()
            except websockets.ConnectionClosedError:
                logger.warning(f"{websocket.remote_address} Suddenly Disconnected")
                clients.pop(websocket.remote_address)
                if host is not None and websocket.remote_address == host.remote_address:
                    logger.warning(f"Host Suddenly Disconnected")
                    await end()
                    host = None
                return
            content = in_stream.split(",")
            try:
                command = content[0]
                data = content[1]
            except IndexError:
                logger.warning(f"Command Missing Data: {in_stream}")
                continue
            if command == "h":
                if host is None:
                    logger.info("Connected")
                    logger.info(f"Setting Host: {websocket.remote_address}")
                    clients[websocket.remote_address] = websocket
                    host = websocket
                    await websocket.send("sh")
                else:
                    logger.info(f"{websocket.remote_address} Tried to host. Host is {host.remote_address}")
                    await websocket.send("fh")
                    await websocket.send("q")
            elif command == "c":
                if host is None:
                    logger.info(f"There is no Host and {websocket.remote_address} Tried to Connect")
                    await websocket.send("fc")
                    await websocket.send("q")
                else:
                    logger.info("Connected")
                    clients[websocket.remote_address] = websocket
                    await websocket.send("sc")
            elif command == "ns":
                name = data
                logger.info(f"Server Name set to '{name}'")
            elif command == "ng":
                logger.info(f"Sending Name to {websocket.remote_address}")
                await websocket.send(f"n,{name}")
            elif command == "u":
                logger.info(f"Updating Timestamp: {data}")
                with open("client.txt", "w") as client_file:
                    client_file.write(f"{data},{'1' if pause else '0'}")
                with open("client.txt", "r+") as client_file:
                    client_data_string = client_file.read()
                    client_data = client_data_string.split(",")
                    pause = client_data[1] == "1"
            elif command == "p":
                pause_data = data.split("|")
                pause = pause_data[1] == '1'
                logger.info(f"Updating Pause: {'Paused' if pause else 'Resumed'}")
                with open("client.txt", "w") as client_file:
                    client_file.write(f"{pause_data[0]},{'1' if pause else '0'}")
                    for client in clients.values():
                        if client != websocket:
                            logger.info(f"Sending to {client.remote_address}")
                            await client.send('u')
            elif command == "d":
                logger.info(f"{websocket.remote_address} Disconnected")
                clients.pop(websocket.remote_address)
                await websocket.close()
                if host is not None and websocket.remote_address == host.remote_address:
                    logger.info(f"Host Disconnected")
                    await end()
                    host = None
                break
            elif command == "q":
                logger.info(f"Host Issued Exit Command")
                clients.pop(websocket.remote_address)
                await end()
                await websocket.send("q")
                break
            else:
                logger.warning(f"Unknown Command: {in_stream}")
        except websockets.ConnectionClosedOK:
            pass


async def main():
    async with websockets.serve(handler, "162.248.100.184", 2023):
        logger.info("Started WebSocket Server. Awaiting Client Connection")
        await asyncio.Future()


if __name__ == "__main__":
    logging.basicConfig(
        format='▸ %(asctime)s.%(msecs)03d %(filename)s:%(lineno)03d %(levelname)s %(message)s',
        level=logging.INFO,
        datefmt='%H:%M:%S')
    logger = logging.getLogger()
    asyncio.run(main())
