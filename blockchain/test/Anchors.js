const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Anchors", function () {
  async function deploy() {
    const [owner, other] = await ethers.getSigners();
    const Anchors = await ethers.getContractFactory("Anchors");
    const anchors = await Anchors.deploy();
    await anchors.waitForDeployment();
    return { anchors, owner, other };
  }

  it("records and verifies an event digest", async function () {
    const { anchors } = await deploy();
    const digest = `0x${"ab".repeat(32)}`;

    await anchors.anchor(digest);

    expect(await anchors.verify(digest)).to.equal(true);
    expect(await anchors.anchoredAt(digest)).to.be.greaterThan(0);
  });

  it("rejects duplicate digests", async function () {
    const { anchors } = await deploy();
    const digest = `0x${"cd".repeat(32)}`;
    await anchors.anchor(digest);

    await expect(anchors.anchor(digest)).to.be.revertedWith("Event hash already anchored");
  });

  it("allows only the deployer to anchor", async function () {
    const { anchors, other } = await deploy();
    const digest = `0x${"ef".repeat(32)}`;

    await expect(anchors.connect(other).anchor(digest)).to.be.revertedWith(
      "Only the anchorer can submit hashes",
    );
  });

  it("rejects an empty digest", async function () {
    const { anchors } = await deploy();
    await expect(anchors.anchor(ethers.ZeroHash)).to.be.revertedWith(
      "Event hash cannot be empty",
    );
  });
});
