import redisClient, { connectRedis } from '../../src/config/redis';

async function main() {
  try {
    await connectRedis();

    const key = 'session:291154f0-083d-44d6-9bd8-23961ebff2c8:code';
    await redisClient.del(key);

    console.log(`Redis key deleted: ${key}`);
  } catch (err) {
    console.error('Error deleting Redis key:', err);
  } finally {
    await redisClient.disconnect();
  }
}

main();