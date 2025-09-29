import { Client } from '@iroha/client'
import * as types from '@iroha/core/data-model'

const kp = types.KeyPair.random()

const client = new Client({
  toriiBaseURL: new URL('http://localhost:8080'),
  chain: '000-000',
  authority: new types.AccountId(kp.publicKey(), new types.DomainId('wonderland')),
  authorityPrivateKey: kp.privateKey(),
})

async function test() {
  await client.transaction(types.Executable.Instructions([
    types.InstructionBox.Register.Domain({
      id: new types.Name('wonderland'),
      logo: null,
      metadata: [],
    }),
  ]))
    .submit({ verify: true })
}