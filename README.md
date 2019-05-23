# cloudwatch-metrics-to-loggly
Sends AWS Cloudwatch metrics to Loggly

## More information about AWS Lambda and Loggly
  * http://aws.amazon.com/lambda/
  * https://www.loggly.com/
  
## Getting started with AWS Lambda
Getting started documentation for AWS lambda can be found in [this 
article](https://docs.aws.amazon.com/lambda/latest/dg/getting-started.html). There is also [this blog post](http://alestic.com/2014/11/aws-lambda-cli) on how to set things up using the command line tools.

## Creating lambda function in AWS
1. Build lambda function code
   1. Clone the Git repository:   
   `git clone https://github.com/psquickitjayant/cloudwatch-metrics-to-loggly.git`
   1. Go to cloned folder:   
   `cd cloudwatch-metrics-to-loggly`
   1. Install dependencies:   
   `npm install`
   1. Create a .zip file for upload to AWS console later:   
   `zip -r cloudwatchMetrics2Loggly.zip index.js node_modules`
1. Create Role
   1. Sign in to your AWS account and open IAM console https://console.aws.amazon.com/iam/
   2. In your IAM console create a new Role say, `cloudwatch-full-access`
   3. Select Role Type as **AWS Lambda**
   4. Apply policy **CloudWatchFullAccess** and save.
1. Create KMS Key
   1. Create a KMS key - http://docs.aws.amazon.com/kms/latest/developerguide/create-keys.html
   1. Encrypt the Loggly Customer Token using the AWS CLI   
   `aws kms encrypt --key-id alias/<your KMS key alias> --plaintext "<your loggly customer token>"`
   1. Copy or keep `CiphertextBlob` attribute for furhter usage in the next step.
1. Create lambda function
   1. Go to https://console.aws.amazon.com/lambda/home
   1. Click **Create a Lambda function** button.
   1. Select **Author from scratch** option
   1. Set **Function name** for example to `cloudwatchMetrics2Loggly`
   1. Set **Runtime** to `Node.js 10.x`
   1. Under **Permissions** click on **Choose or create an execution role**
   1. Select **Use an existing role** and select **cloudwatch-full-access** role created above in step 1
   1. Click on **Create function** button
   1. Scroll to **Function code** section
   1. Select **Upload a .zip file** in **Code entry type** dropdown
   1. Upload lambda function (zip file `cloudwatchMetrics2Loggly.zip` you made above)
   1. Go to **Environment variables** section
   1. Define new environment variable **kmsEncryptedCustomerToken** and set it to `CiphertextBlob` value from step 3 above (Create KMS Key)
   1. Scroll to **Basic settings** section
   1. Set **Memory (MB)** to **512 MB**
   1. Set Timeout to **2** minutes
   1. Scroll up to **Designer** section (expand if it's collapsed)
   1. Click on **CloudWatch Events** in **Add triggers** section to add the trigger item
   1. Click on added **CloudWatch Events** trigger and scroll down to trigger settings
   1. Select **Create a new rule** in **Rule** dropdown
   1. **Name:** Provide any customized name. e.g.  cloudwatchMetrics2Loggly Event Source
   1. **Description:** Invokes Lambda function in every 5 minutes
   1. **Schedule expression:** rate(5 minutes)
   1. Make sure the checkbox **Enable trigger** is checked
   1. Click on **Add**
   1. Click on **Save** to save the whole lambda function.
   1. Wait for the events to occur in Loggly

**NOTE**: Always use latest version of **AWSCLI**. Some features like KMS may not work on older versions of AWSCLI. To upgrade, use the command given below

`pip install --upgrade awscli`

