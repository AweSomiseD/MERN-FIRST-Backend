const onlineUsers = new Map();

export const isUserOnline = (userId) => {
  return onlineUsers.has(String(userId));
};

export const addOnlineUser = (userId) => {
  const id = String(userId);
  const currentCount = onlineUsers.get(id) || 0;

  onlineUsers.set(id, currentCount + 1);

  return currentCount;
};

export const removeOnlineUser = (userId) => {
  const id = String(userId);
  const currentCount = onlineUsers.get(id) || 0;

  if (currentCount <= 1) {
    onlineUsers.delete(id);
    return 0;
  }

  const remainingCount = currentCount - 1;
  onlineUsers.set(id, remainingCount);

  return remainingCount;
};
