import { io } from "socket.io-client";

const conversationId = "6abcbcff4a777775d84b59d5";

// Listener token
const listenerToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhOWU0ODRjYmE2YmJkYTI0NTJhYmRhNyIsInJvbGUiOiJsaXN0ZW5lciIsImlhdCI6MTc5MDc2NjIxNywiZXhwIjoxNzkwNzY3MTE3fQ.fYQOgcazu0Wkz-TneLHSYaCW4kEJ_QTYE6R25xD5tx0";

// Artist token
const artistToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhOWZkZDMxMGI1ZDFhNDY3OWFkNDE3YSIsInJvbGUiOiJhcnRpc3QiLCJpYXQiOjE3OTA3NjYyNzMsImV4cCI6MTc5MDc2NzE3M30.lnqmuIo0UqTrpFUr0t3GDHq7PITCuVm9XKjXqiWTBcw";

const listenerSocket = io("http://localhost:3000", {
  extraHeaders: {
    Cookie: `accessToken=${listenerToken}`,
  },
});

const artistSocket = io("http://localhost:3000", {
  extraHeaders: {
    Cookie: `accessToken=${artistToken}`,
  },
});

let listenerReady = false;
let artistReady = false;

function tryStart() {
  if (!listenerReady || !artistReady) return;

  console.log("\nBoth sockets are ready.");
  console.log("Artist joining conversation...");

  artistSocket.emit("conversation:join", conversationId, (response) => {
    console.log("ARTIST JOIN RESPONSE:", response);

    if (!response.success) {
      console.log("Artist failed to join conversation.");
      return;
    }

    console.log("Listener joining conversation...");

    listenerSocket.emit("conversation:join", conversationId, (response) => {
      console.log("LISTENER JOIN RESPONSE:", response);

      if (!response.success) {
        console.log("Listener failed to join conversation.");
        return;
      }

      console.log("\nListener sending message...");

      listenerSocket.emit(
        "message:send",
        {
          conversationId,
          content: "Hello Artist - unread test",
          clientMessageId: `two-user-test-${Date.now()}`,
        },
        (response) => {
          console.log("LISTENER MESSAGE RESPONSE:", response);

          if (!response.success) {
            console.log("Message failed.");
            return;
          }

          console.log(
            "\nMessage sent. Artist should now have an unread message.",
          );

          setTimeout(() => {
            console.log("\nArtist marking conversation as read...");

            artistSocket.emit(
              "conversation:read",
              conversationId,
              (response) => {
                console.log("ARTIST READ RESPONSE:", response);

                console.log("\nTwo-user test finished.");

                listenerSocket.disconnect();
                artistSocket.disconnect();

                process.exit(0);
              },
            );
          }, 500);
        },
      );
    });
  });
}

listenerSocket.on("connect", () => {
  console.log("Listener connected:", listenerSocket.id);
});

listenerSocket.on("socket:ready", () => {
  console.log("Listener socket ready.");
  listenerReady = true;
  tryStart();
});

listenerSocket.on("message:new", (message) => {
  console.log("LISTENER NEW MESSAGE:", message);
});

listenerSocket.on("connect_error", (error) => {
  console.log("Listener connection error:", error.message);
});

artistSocket.on("connect", () => {
  console.log("Artist connected:", artistSocket.id);
});

artistSocket.on("socket:ready", () => {
  console.log("Artist socket ready.");
  artistReady = true;
  tryStart();
});

artistSocket.on("message:new", (message) => {
  console.log("ARTIST NEW MESSAGE:", message);
});

artistSocket.on("connect_error", (error) => {
  console.log("Artist connection error:", error.message);
});

setTimeout(() => {
  console.log("\nTest timeout.");

  listenerSocket.disconnect();
  artistSocket.disconnect();

  process.exit(1);
}, 10000);
