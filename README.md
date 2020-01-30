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
   * Clone the Git repository:   
   `git clone https://github.com/psquickitjayant/cloudwatch-metrics-to-loggly.git`
   * Go to cloned folder:   
   `cd cloudwatch-metrics-to-loggly`
   * Install dependencies:   
   `npm install`
   * Create a .zip file for upload to AWS console later:   
   `zip -r cloudwatchMetrics2Loggly.zip index.js node_modules`
1. Create Role
   * Sign in to your AWS account and open IAM console https://console.aws.amazon.com/iam/
   * In your IAM console create a new Role say, `cloudwatch-full-access`
   * Select Role Type as **AWS Lambda**
   * Apply policy **CloudWatchFullAccess** and save.
1. Create KMS Key
   * Create a KMS key - http://docs.aws.amazon.com/kms/latest/developerguide/create-keys.html
   * Encrypt the Loggly Customer Token using the AWS CLI   
   `aws kms encrypt --key-id alias/<your KMS key alias> --plaintext "<your loggly customer token>"`
   * Copy or keep `CiphertextBlob` attribute for furhter usage in the next step.
1. Create lambda function
   * Go to https://console.aws.amazon.com/lambda/home
   * Click **Create a Lambda function** button.
   * Select **Author from scratch** option
   * Set **Function name** for example to `cloudwatchMetrics2Loggly`
   * Set **Runtime** to `Node.js 10.x`
   * Under **Permissions** click on **Choose or create an execution role**
   * Select **Use an existing role** and select **cloudwatch-full-access** role created above in step 1
   * Click on **Create function** button
   * Scroll to **Function code** section
   * Select **Upload a .zip file** in **Code entry type** dropdown
   * Upload lambda function (zip file `cloudwatchMetrics2Loggly.zip` you made above)
   * Go to **Environment variables** section
   * Define new environment variable **kmsEncryptedCustomerToken** and set it to `CiphertextBlob` value from step 3 above (Create KMS Key)
   * Scroll to **Basic settings** section
   * Set **Memory (MB)** to **512 MB**
   * Set Timeout to **2** minutes
   * Scroll up to **Designer** section (expand if it's collapsed)
   * Click on **CloudWatch Events** in **Add triggers** section to add the trigger item
   * Click on added **CloudWatch Events** trigger and scroll down to trigger settings
   * Select **Create a new rule** in **Rule** dropdown
   * **Name:** Provide any customized name. e.g.  cloudwatchMetrics2Loggly Event Source
   * **Description:** Invokes Lambda function in every 5 minutes
   * **Schedule expression:** rate(5 minutes)
   * Make sure the checkbox **Enable trigger** is checked
   * Click on **Add**
   * Click on **Save** to save the whole lambda function.
   * Wait for the events to occur in Loggly

**NOTE**: Always use latest version of **AWSCLI**. Some features like KMS may not work on older versions of AWSCLI. To upgrade, use the command given below

`pip install --upgrade awscli`

