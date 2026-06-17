import {
  Actions,
  Button,
  Card,
  type CardElement,
  CardText,
  Divider,
  Field,
  Fields,
  LinkButton,
  Section,
} from 'chat';

export function buildDemoCard(platform: string): CardElement {
  return Card({
    title: 'Card from chat-sdk',
    subtitle: `Posted via @novu/chat-sdk-adapter on ${platform}`,
    children: [
      CardText(
        'This card was posted with `thread.post(Card(...))` and normalized into an agent reply payload.',
      ),
      Divider(),
      Fields([
        Field({ label: 'Platform', value: platform }),
        Field({ label: 'Source', value: 'chat-sdk' }),
      ]),
      Section([CardText('Buttons below emit `onAction` callbacks back through the bridge.')]),
      Actions([
        Button({ id: 'card-approve', label: 'Approve', style: 'primary', value: 'approved' }),
        Button({ id: 'card-dismiss', label: 'Dismiss', style: 'danger', value: 'dismissed' }),
        LinkButton({ url: 'https://novu.co', label: 'Open Novu' }),
      ]),
    ],
  });
}
