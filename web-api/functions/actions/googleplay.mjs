import { google } from "googleapis";
google.options({ headers: { "Content-Type": "application/json" } });

async function connectToService(gameID) {
  try {
    const apiObj = await getGameServiceAPIObject(gameID, "googleplayservices");

    const keyFile = JSON.parse(apiObj.key);
    const packageName = apiObj.packageName;

    if (keyFile && packageName) {
      const auth = new google.auth.GoogleAuth({
        credentials: keyFile,
        scopes: ["https://www.googleapis.com/auth/androidpublisher"],
      });
      const gpAPI = google.androidpublisher({ version: "v3", auth });

      return { gpAPI, packageName };
    } else {
      throw new Error(
        "No key file or package name found for Google Play Services API. GameID: " +
          gameID
      );
    }
  } catch (error) {
    console.log("Error connecting to Google Play Services API: ", error);
    throw new Error();
  }
}

async function listExistingIapProducts(gameID) {
  try {
    const { gpAPI, packageName } = await connectToService(gameID);

    const result = await gpAPI.inappproducts.list({ packageName });
    const products = result.data.inappproduct;
    if (products) {
      //   products.forEach(product => {
      //     console.log(`Product ID: ${product.sku}`);
      //     console.log(`Title: ${product.listings['en-US'].title}`);
      //     console.log(`Description: ${product.listings['en-US'].description}`);
      //     console.log(`Price:`, product)
      //     // console.log(`Price: ${product.prices['US'].priceMicros / 1e6} ${product.prices['US'].currency}`);
      //     console.log('-----------------------------');
      //   });
      return products;
    } else {
      console.log("No IAP products found.");
      return [];
    }
  } catch (error) {
    console.error(error);
    throw new Error(error);
  }
}
async function deleteIapProducts(gameID, skuArray) {
  try {
    const { gpAPI, packageName } = await connectToService(gameID);

    const deleteRequests = skuArray.map((sku) => {
      return {
        sku: sku,
        packageName: packageName,
      };
    });

    const result = await gpAPI.inappproducts.batchDelete({
        packageName: packageName,
        resource: {
            requests:deleteRequests
        },
    });
  } catch (error) {
    console.error(error);
    throw new Error(error);
  }
}

export async function uploadIapConfig(gameID, cookedContent) {
  try {
    const { gpAPI, packageName } = await connectToService(gameID);

    const existingInnapps = (await listExistingIapProducts(gameID)) || [];

    // console.log('existingInnapps', existingInnapps.map((iap) => iap.sku))

    if (existingInnapps.length > 0) {
      // If there are any existing IAPs, we need to get the IDs that are now must be deleted
      // But we also must handle only strix-created IAPs
      const existingSku = existingInnapps
        .map((iap) => iap.sku)
        .filter((id) => id.startsWith("strix_"));
      const diffIapSku = cookedContent.map((iap) => iap.asku);
      const toDelete = existingSku.filter((id) => !diffIapSku.includes(id));

      if (toDelete.length > 0) {
        await deleteIapProducts(gameID, toDelete);
      }
    }
    
    const funnyCountries = ['CL', 'JP']
    function makePriceMicro(price, regionCode) {
        let safePrice = parseFloat(parseFloat(price).toFixed(2))
        if (funnyCountries.includes(regionCode)) {
            // Handle countries that can't have decimal prices
            safePrice = parseFloat(parseFloat(price).toFixed(0))
        }
        const result = parseInt(safePrice * 1e6).toString()
        // console.log('Region:', regionCode, 'Input price: ', safePrice, 'Result: ', result)
        return result;
    }

    // Transforming the config to the google format
    const updateRequests = cookedContent.map((iap) => {
      return {
        autoConvertMissingPrices: true,
        allowMissing: true,
        latencyTolerance: "PRODUCT_UPDATE_LATENCY_TOLERANCE_LATENCY_TOLERANT",
        packageName: packageName,
        sku: iap.asku,
        inappproduct: {
            packageName: packageName,
            sku: iap.asku,
            status: "active",
            purchaseType: "managedUser",
            defaultLanguage: "en-US",
            defaultPrice: {
              priceMicros: makePriceMicro(iap.pricing.moneyCurr[0].value, iap.pricing.moneyCurr[0].region),
              currency: iap.pricing.moneyCurr[0].currency,
            },
            prices: iap.pricing.moneyCurr.reduce((acc, region) => {
              acc[region.region] = {
                priceMicros: makePriceMicro(region.value, region.region),
                currency: region.currency,
              };
              return acc;
            }, {}),
            listings: {
              "en-US": {
                title: iap.name[0].value,
                description: iap.desc[0].value,
              },
            },
        },
      };
    });

    try {
      const updateReq = await gpAPI.inappproducts.batchUpdate({
        packageName: packageName,
        resource: {
            requests: updateRequests
        },
      });
    } catch (error) {
      throw error;
    }

  } catch (error) {
    throw error;
  }
}

