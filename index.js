const dhive = require('@hiveio/dhive');
const axios = require('axios');

const paccount = process.env.PACCOUNT || 'ecency';
const pprivateKey = process.env.PKEY || '5xxx';
const period = process.env.PERIOD || '3600000'; // as in ms, 3600000 = 1h
const threshold = process.env.THRESHOLD || '0.15'; // as in percentage 1=100%, 15%

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

const isPeriod = (someDate) => {
  const now = new Date()
  return ((new Date) - someDate) < period;
}

const getHistory = async () => {
  let ops = [];
  let first_id = 999;
  let history = [];
  let timestamp = new Date();

  while (isPeriod(timestamp)) {
    let h1;
    try {
      h1 = await client.call("condenser_api", "get_account_history", [paccount, first_id-1000, 1000, ...filters]);    
    } catch (error) {
      break;
    }
    const lelem1 = h1[0];
    first_id = lelem1[0];
    history = [...h1];
    console.log('DHF reward history', history.length);

    for (let index = history.length-1; index >= 0; index--) {
      const element = history[index];
      const op = element[1];
      op.op[1].timestamp = `${op.timestamp}.000Z`;
      op.op[1].block = op.block;
      const ndate = new Date(`${op.timestamp}.000Z`)
      timestamp = ndate;
      // take only rewards within period
      if (isPeriod(ndate)) {
        ops.push(op.op[1]);
      }
    }
    //console.log(ops);
  }
  return ops;
}

const summ = (items, prop) => {
  return items.reduce( function(a, b){
    return a + parseFloat(b[prop]);  
  }, 0);
};

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
  let return_amount = (sum_reward-differ).toFixed(3);
  console.log('return amount', return_amount);

  if (differ > 0.001 && differ < sum_reward && sum_reward*threshold < return_amount) {
    op = [
      "transfer",
      { 
        amount: `${return_amount} HBD`,
        from: paccount,
        memo: `Return HBD to stabilizer ~$${hbd_price.hive_dollar.usd}`,
        to: 'hbdstabilizer'
      }
    ]
    operations.push(op);  
    console.log('operations', operations);
    
    const privateKey = dhive.PrivateKey.fromString(pprivateKey);
    const reso = await client.broadcast.sendOperations(operations, privateKey);
    console.log('result', reso);
  }
  process.exit();
}

init().catch(console.error);