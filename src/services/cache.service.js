// src/services/cache.service.js
import { redisClient } from "../config/redis.js";

const getCache = async (key) => {
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

const setCache = async (key, value, ttlSeconds = 60) => {
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
};

const deleteCache = async (key) => {
  await redisClient.del(key);
};

const deleteCacheByPattern = async (pattern) => {
  const keys = await redisClient.keys(pattern);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
};

export { getCache, setCache, deleteCache, deleteCacheByPattern };
