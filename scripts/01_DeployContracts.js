const {
  Contract,
  ContractFactory,
  utils,
  BigNumber,
  constants,
} = require("ethers");

const WETH9 = require("../WETH9.json");

const factoryArtifact = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const routerArtifact = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");
const pairArtifact = require("@uniswap/v2-periphery/build/IUniswapV2Pair.json");
const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory(
    factoryArtifact.abi,
    factoryArtifact.bytecode
  );
  const factory = await Factory.deploy(owner.address);
  await factory.deployed();
  console.log("factory", factory.address);

  const Usdt = await ethers.getContractFactory("Tether");
  const usdt = await Usdt.deploy();
  console.log("usdt", usdt.address);

  const Usdc = await ethers.getContractFactory("UsdCoin");
  const usdc = await Usdc.deploy();
  console.log("usdc", usdc.address);

  await usdt.connect(owner).mint(owner.address, utils.parseEther("100000"));
  await usdc.connect(owner).mint(owner.address, utils.parseEther("100000"));

  const tx1 = await factory.createPair(usdt.address, usdc.address);
  await tx1.wait();

  const pairAddress = await factory.getPair(usdt.address, usdc.address);
  console.log("pairAddress", pairAddress);

  const pair = new Contract(pairAddress, pairArtifact.abi, owner);

  const Weth = new ContractFactory(WETH9.abi, WETH9.bytecode, owner);
  const weth = await Weth.deploy();
  console.log("weth", weth.address);

  const Router = new ContractFactory(
    routerArtifact.abi,
    routerArtifact.bytecode,
    owner
  );
  const router = await Router.deploy(factory.address, weth.address);
  console.log("router", router.address);

  const approve1 = await usdt.approve(router.address, constants.MaxUint256);
  await approve1.wait();
  const approve2 = await usdc.approve(router.address, constants.MaxUint256);
  await approve2.wait();

  const token0Amount = utils.parseUnits("100");
  const token1Amount = utils.parseUnits("100");

  const deadline = Math.floor(Date.now() / 1000) + 10 * 60;

  const addLiquidityTx = await router.connect(owner).addLiquidity(
    usdt.address,
    usdc.address,
    token0Amount, //100 tokens for liquidity
    token1Amount, //100 tokens for liquidity
    0,
    0,
    owner.address,
    deadline,
    { gasLimit: utils.hexlify(1000000) }
  );

  await addLiquidityTx.wait();

  // Swap functionality
  const amountOutMin = 0;
  const path = [usdt.address, usdc.address]; // Token0 to Token1 swap
  const to = owner.address;
  const deadlineSwap = Math.floor(Date.now() / 1000) + 10 * 60;

  const swapTx = await router.connect(owner).swapExactTokensForTokens(
    token0Amount, //How much token want to swap //amountOut:
    amountOutMin, //amountInMax
    path, //path
    to, //to
    deadlineSwap, //deadline
    { gasLimit: utils.hexlify(1000000) }
  );

  await swapTx.wait();

  const reserves = await pair.getReserves();
  console.log("reserves after swap", reserves);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
