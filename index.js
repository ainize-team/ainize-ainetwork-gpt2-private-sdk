const _ = require('lodash');
const firebase = require('firebase/app');
require('firebase/auth');
require('firebase/storage');
require('firebase/functions');
require('firebase/database');

const {
  buildAinftTrainRequestTxBody,
  buildAuthTxBody,
  signTx,
} = require('./AinUtil');

const firebaseConfig = {
  apiKey: process.env.GPT2_FIREBASE_API_KEY,
  authDomain: process.env.GPT2_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.GPT2_FIREBASE_DATABASE_URL,
  projectId: process.env.GPT2_FIREBASE_PROJECT_ID,
  storageBucket: process.env.GPT2_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.GPT2_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.GPT2_FIREBASE_APP_ID,
  measurementId: process.env.GPT2_FIREBASE_MEASUREMENT_ID,
};

let gpt2Firebase = {};
if (!firebase.apps.find((el) => el.name_ === 'GPT2Firebase')) {
  gpt2Firebase = firebase.initializeApp(firebaseConfig, 'GPT2Firebase');
  console.log('GPT-2 Firebase initialized.');
} else {
  gpt2Firebase = firebase.app('GPT2Firebase');
}

const GPT2FirebaseManager = {
  async signInWithCustomToken(address, privateKey) {
    try {
      const timestamp = Date.now();
      const txBody = buildAuthTxBody(address, timestamp);
      const { signedTx } = signTx(txBody, privateKey);
      const response = await gpt2Firebase
        .functions()
        .httpsCallable('getAuthToken')(signedTx);
      const customToken = _.get(response, 'data.customToken');
      await gpt2Firebase.auth().signInWithCustomToken(customToken);
      return response.data;
    } catch (e) {
      console.error(e);
      return null;
    }
  },
  async requestJobType(task) {
    const res = await gpt2Firebase.functions().httpsCallable('getJobTypes')();

    let ret = {};

    if (task && res.data) {
      ret = [];
      for (const key in res.data) {
        const jobInfo = res.data[key];
        if (task === jobInfo.task) {
          ret.push({
            label: jobInfo.name,
            value: key,
            urlTemplate: {
              demo: jobInfo.demoURLTemplate,
              api: jobInfo.apiURLTemplate,
              insight: jobInfo.insightURLTemplate,
            },
          });
        }
      }

      return ret;
    }

    Object.entries(res.data).forEach(([key, value]) => {
      // FIXME(YoungJaeKim):  refactoring after eth Denver event
      if(value.task !== 'ainft-chatbot'){
        ret[value.name] = key;
      }
    });
    return ret;
  },
  async uploadAINFTImageFile(address, trainId, file) {
    const ref = gpt2Firebase
      .storage()
      .ref(`ainftImage/${address}/${trainId}/${file.name}`);

    await ref.put(file);

    return await ref.getDownloadURL();
  },
  async uploadDataFile(address, trainId, file, callback) {
    const ref = gpt2Firebase
      .storage()
      .ref(`trainData/${address}/${trainId}/${file.name}`);

    const uploadTask = ref.put(file);

    uploadTask.on('state_changed', (snapshot) => {
      let progress = parseInt(
        (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
      );
      callback(progress);
    });

    return uploadTask;
  },
  async requestAinftTrain(data) {
    const {
      trainId,
      fileName,
      fileSize,
      jobType,
      address,
      privateKey,
      ainizeUid,
      ainizeMail,
      metadata,
    } = data;

    try {
      const timestamp = Date.now();
      const txBody = buildAinftTrainRequestTxBody({
        trainId,
        fileName,
        fileSize,
        jobType: jobType.value,
        jobTypeName: jobType.label,
        address,
        ainizeUid,
        ainizeMail,
        metadata,
        timestamp,
      });
      const { signedTx } = signTx(txBody, privateKey);
      const { result, ...rest } = await gpt2Firebase
        .functions()
        .httpsCallable('sendSignedTransaction')(signedTx);
    } catch (error) {
      console.error(error);
    }
  },
  async getTrainIdInfo(address, trainId, task) {
    if (!address || !trainId) {
      return [null, false];
    }

    const taskInfo = (
      await gpt2Firebase
        .database()
        .ref(`train_tasks/${address}/${trainId}`)
        .once('value')
    ).val();

    if (!taskInfo) {
      return [null, false];
    }

    if (task) {
      const { request, response, mint } = taskInfo;

      if (taskInfo.request.task === task) {
        const file = {
          name: request.data.fileName,
          size: request.data.fileSize,
        };
        const nft = {
          asset_contract: {
            address: request.data.metadata.sourceNftContractAddress,
          },
          token_id: request.data.metadata.sourceNftTokenId,
          ainftImageUrl: request.data.metadata.ainftImageUrl,
          image_url: request.data.metadata.sourceImageUrl,
          description: request.data.metadata.description,
          name: request.data.metadata.name,
        };
        const nickname = trainId;

        const isTrained = (response !== undefined && response.few_shot_learning !== undefined) ? (response.few_shot_learning.status === 'ainize') : undefined;

        return [
          {
            file,
            nft,
            nickname,
            mint,
          },
          isTrained,
        ];
      } else {
        return [null, false];
      }
    }
  },
  async setErc721TxHash(txHash, appName) {
    try {
      await gpt2Firebase.functions().httpsCallable('updateMintInfo')({
        trainId: appName,
        txHash,
      });
      await gpt2Firebase
        .database()
        .ref(`/teachable_ainft/erc721_mint_pending_txs/${txHash}`)
        .set(appName);
    } catch (e) {
      console.error(e);
    }
  },
  async setHrc721TxHash(txHash, appName) {
    try {
      await gpt2Firebase.functions().httpsCallable('updateMintInfo')({
        trainId: appName,
        txHash,
      });
      await gpt2Firebase
        .database()
        .ref(`/teachable_ainft/hrc721_mint_pending_txs/${txHash}`)
        .set(appName);
    } catch (e) {
      console.error(e);
    }
  },
};

module.exports = GPT2FirebaseManager;
