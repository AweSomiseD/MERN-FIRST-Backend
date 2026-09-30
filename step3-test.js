import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  extraHeaders: {
    Cookie:
      "accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhOWU0ODRjYmE2YmJkYTI0NTJhYmRhNyIsInJvbGUiOiJsaXN0ZW5lciIsImlhdCI6MTc5MDc2NTExNywiZXhwIjoxNzkwNzY2MDE3fQ.Hohba60AfLYBrSKkA9R92S7Aodr2VM0riJ3T8er4b-0",
  },
});

const conversationId = "6abcbcff4a777775d84b59d5";

socket.on("connect", () => {
  console.log("Connected:", socket.id);
});

socket.on("socket:ready", () => {
  console.log("Socket is ready");
  console.log("Joining conversation...");

  socket.emit("conversation:join", conversationId, (response) => {
    console.log("JOIN RESPONSE:", response);

    if (!response.success) {
      console.log("Conversation join failed.");
      return;
    }

    console.log("Sending message...");

    socket.emit(
      "message:send",
      {
        conversationId,
        content: "Hello from Socket.IO test",
        clientMessageId: `test-message-${Date.now()}`,
      },
      (response) => {
        console.log("MESSAGE RESPONSE:", response);

        if (!response.success) {
          console.log("Message send failed.");
          return;
        }

        console.log("Marking conversation as read...");

        socket.emit("conversation:read", conversationId, (response) => {
          console.log("READ RESPONSE:", response);
        });
      },
    );
  });
});

socket.on("message:new", (message) => {
  console.log("NEW MESSAGE:", message);
});

socket.on("connect_error", (error) => {
  console.log("Connection Error:", error.message);
});

setTimeout(() => {
  console.log("Test finished.");

  socket.disconnect();
  process.exit(0);
}, 5000);
