import redisClient, { connectRedis } from '../../src/config/redis';

async function main() {
  await connectRedis();
  await redisClient.set(
    'session:291154f0-083d-44d6-9bd8-23961ebff2c8:code',
    'print("latest redis version")'
    );
  console.log('Redis set!');
  await redisClient.disconnect();
}

main();