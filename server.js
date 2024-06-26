import { publicIpv4 } from "public-ip";
import express from "express";
import pg from "pg";
import cron from "node-cron";
import axios from "axios";
import ping from "ping";
import { config } from "dotenv";

config();
const app = express();
const { USER, PASSWORD, PORT, DBNAME, HOST, DBPORT } = process.env;
console.log(process.env.PASSWORD);

const ipAddr = await getIp();

//connection creds to db
const client = new pg.Client({
  user: process.env.USER,
  host: process.env.HOST,
  database: process.env.DBNAME,
  password: process.env.PASSWORD,
  port: process.env.DBPORT,
});

//db connection
client.connect((data) => {
  console.log("db connected", data);
});

// function to get public IP
async function getIp() {
  try {
    return await publicIpv4();
  } catch (err) {
    console.log("couldn't get IP address", err);
  }
}

//function to get isp provider
async function getIsp(ip) {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    return response.data["isp"];
  } catch (err) {
    console.log("Erro occured while fetching isp details", err);
    return "unknown ISP";
  }
}

//function to ping ip

async function pingIp(ip) {
  try {
    const startTime = new Date();
    const result = await ping.promise.probe(ip, {
      extra: ["-n", "2"],
    });
    const endTime = new Date();

    return { startTime, result, endTime };
  } catch (err) {
    console.log("unable to run ping scan");
  }
}

// Function to save to DB

async function saveDb(ip, isp, pingData) {
  try {
    console.log("working in saveDB", pingData.endTime);
    const query = `
        INSERT INTO network_stats (ip_addr, isp, start_time, end_time, min, max, avg, packet_loss) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
    const values = [
      ip,
      isp,
      pingData.startTime,
      pingData.endTime,
      pingData.result.min,
      pingData.result.max,
      pingData.result.avg,
      pingData.result.packetLoss,
    ];

    await client.query(query, values);
  } catch (err) {
    console.log("unable to operate with db", err);
  }
}

// main function
async function main(ip) {
  const ispName = await getIsp(ip);
  console.log(`public ip is: ${ipAddr}, ISP: ${ispName}`);
  const pingData = await pingIp(ip);
  console.log(pingData);
  await saveDb(ipAddr, ispName, pingData);

  console.log("ping completed and result saved");
}

main(ipAddr);

app.listen(PORT, () => {
  console.log(`server running`);
});
