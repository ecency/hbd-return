const dhive = require('@hiveio/dhive');
const axios = require('axios');

const paccount = process.env.PACCOUNT || 'ecency';
const pprivateKey = process.env.PKEY || '5xxx';

const SERVERS = [
  'https://rpc.ecency.com',
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://anyx.io',
];

const client = new dhive.Client(SERVERS, {
  timeout: 4000,
  failoverThreshold: 10,
  consoleOnFailover: true,
});
const ops = dhive.utils.operationOrders;
const filters = dhive.utils.makeBitMaskFilter([ops.proposal_pay]);

let first_id = -1;
let history = [];

const getHistory = async () => {
  const h1 = await client.call("condenser_api", "get_account_history", [paccount, first_id, 1000, ...filters]);
  const lelem1 = h1[0];
  first_id = lelem1[0];
  const h2 = await client.call("condenser_api", "get_account_history", [paccount, first_id-1000, 1000, ...filters]);
  const lelem2 = h2[0];
  first_id = lelem2[0];
  const h3 = await client.call("condenser_api", "get_account_history", [paccount, first_id-1000, 1000, ...filters]);
  const lelem3 = h3[0];
  first_id = lelem3[0];
  history = [...h1, ...h2, ...h3];
  
  console.log('DHF reward history', history.length);
  let ops = [];
  
  for (let index = 0; index < history.length; index++) {
    const element = history[index];
    const op = element[1];
    op.op[1].timestamp = `${op.timestamp}.000Z`;
    op.op[1].block = op.block;
    // take only today's rewards
    if (isToday(new Date(op.op[1].timestamp))) {
      ops.push(op.op[1]);
    }
  }
  //console.log(ops);
  return ops;
}

const summ = (items, prop) => {
  return items.reduce( function(a, b){
    return a + parseFloat(b[prop]);  
  }, 0);
};

const isToday = (someDate) => {
  const today = new Date()
  return (someDate.getUTCDate() == today.getUTCDate()) &&
    someDate.getUTCMonth() == today.getUTCMonth() &&
    someDate.getFullYear() == today.getFullYear()
}

const getHBDPrice = async () => {
  const requestConf = {
    url: "https://api.coingecko.com/api/v3/simple/price?ids=hive_dollar&vs_currencies=USD",
    method: "GET",
    responseType: "json"
  }
  const r = await axios(requestConf);
  return r.data;
}


// Init, main script

init = async() => {
  console.log('date', new Date().toISOString());

  // get account history of rewards 
  const rewards = await getHistory();

  // sum rewards
  const sum_reward = summ(rewards, 'payment');
  console.log('sum payment', sum_reward);

  // get HBD price
  const hbd_price = await getHBDPrice();
  console.log('hbd price', hbd_price);

  // calculate difference
  let differ = 0;
  if (hbd_price && hbd_price.hive_dollar && hbd_price.hive_dollar.usd) {
    differ = sum_reward/hbd_price.hive_dollar.usd;
  }
  console.log('difference', differ );

  // send back difference above $1 to hbdstabilizer.
  let op = [];
  let operations = [];
  if (differ > 0.001 && differ < sum_reward) {
    op = [
      "transfer",
      { 
        amount: `${(sum_reward-differ).toFixed(3)} HBD`,
        from: paccount,
        memo: "Return HBD to stabilizer",
        to: 'hbdstabilizer'
      }
    ]
    operations.push(op);  
    console.log('operations', operations);
    
    const privateKey = dhive.PrivateKey.fromString(pprivateKey);
    const reso = await client.broadcast.sendOperations(operations, privateKey);
    console.log('result', reso);
  }
}

init().catch(console.error);