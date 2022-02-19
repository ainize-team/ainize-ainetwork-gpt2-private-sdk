const ainUtil = require('@ainblockchain/ain-util');

const CURRENT_PROTOCOL_VERSION = '0.5.0';

function buildTrainRequestTxPath(userAddress, trainId) {
  return `/train_tasks/${userAddress}/${trainId}/request`;
}

function buildAinftTrainRequestTxBody(payload) {
  const { timestamp, address, trainId, metadata, ...rest } = payload;

  return {
    operation: {
      type: 'SET_VALUE',
      ref: buildTrainRequestTxPath(address, trainId),
      value: {
        data: {
          ...rest,
          metadata,
        },
      },
    },
    timestamp,
    nonce: -1,
  };
}

function buildAuthTxBody(userAddress, timestamp) {
  return {
    operation: {
      type: 'GET_AUTH_TOKEN',
      value: {
        params: {
          address: userAddress,
        },
      },
    },
    timestamp,
    nonce: -1,
  };
}

function buildAuthTxBodyYJ(address, privateKey) {
  const timestamp = Date.now();

  const payload = signTx(
    {
      operation: {
        type: 'GET_AUTH_TOKEN',
        ref: '',
        value: {
          params: {
            address: address,
          },
        },
      },
      timestamp,
      nonce: -1,
    },
    privateKey,
  );

  return payload;
}

function signTx(txBody, privateKey) {
  const keyBuffer = Buffer.from(privateKey, 'hex');
  const sig = ainUtil.ecSignTransaction(txBody, keyBuffer);
  const sigBuffer = ainUtil.toBuffer(sig);
  const lenHash = sigBuffer.length - 65;
  const hashedData = sigBuffer.slice(0, lenHash);
  const txHash = '0x' + hashedData.toString('hex');
  return {
    txHash,
    signedTx: {
      protoVer: CURRENT_PROTOCOL_VERSION,
      tx_body: txBody,
      signature: sig,
    },
  };
}

module.exports = {
  buildAinftTrainRequestTxBody,
  buildAuthTxBody,
  signTx,
}
