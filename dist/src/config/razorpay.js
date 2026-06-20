import Razorpay from 'razorpay';
import { config } from './config';
const razorpay = new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
});
export default razorpay;
